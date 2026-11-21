#!/usr/bin/env node
/**
 * One-off import of Appwrite templates into the PostgreSQL backend.
 *
 * Imported templates are stored as SHARED base templates (user_id IS NULL), so
 * they appear through the existing `?base=true` listing and can be cloned with
 * `baseTemplateId`. Legacy Appwrite user ids are NOT copied: they do not exist
 * in auth_users, so an owner-bound copy would be invisible to everyone.
 *
 * Idempotent on re-run: a shared template with the same title is skipped.
 *
 * Usage:
 *   APPWRITE_ENDPOINT=... APPWRITE_PROJECT_ID=... APPWRITE_DATABASE_ID=... \
 *   APPWRITE_API_KEY=... DATABASE_URL=... \
 *   node --import tsx scripts/import-appwrite-templates.mts [--dry-run]
 */

import { Client, Query, TablesDB } from "node-appwrite";

const TEMPLATE_COLUMNS = [
  "title",
  "description",
  "tags",
  "html",
  "css",
  "test_data",
  "orientation",
  "paper_size",
  "margin_top",
  "margin_right",
  "margin_bottom",
  "margin_left",
] as const;

const DEFAULTS: Record<string, string> = {
  orientation: "portrait",
  paper_size: "A4",
  margin_top: "20mm",
  margin_right: "20mm",
  margin_bottom: "20mm",
  margin_left: "20mm",
};

interface AppwriteTemplateRow {
  $id: string;
  title?: string;
  description?: string | null;
  tags?: string[] | null;
  html?: string;
  css?: string;
  test_data?: string | null;
  orientation?: string;
  paper_size?: string;
  margin_top?: string;
  margin_right?: string;
  margin_bottom?: string;
  margin_left?: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing environment variable: ${name}`);
  }
  return value;
}

function toImportableValues(row: AppwriteTemplateRow): Record<string, string | string[] | null> {
  const values: Record<string, string | string[] | null> = {};

  for (const column of TEMPLATE_COLUMNS) {
    const fromRow = (row as unknown as Record<string, unknown>)[column];

    if (column === "tags") {
      values[column] = Array.isArray(fromRow) ? (fromRow as string[]) : [];
      continue;
    }
    if (column === "description") {
      values[column] = typeof fromRow === "string" ? fromRow : null;
      continue;
    }

    const fallback = DEFAULTS[column];
    if (typeof fromRow === "string" && fromRow.length > 0) {
      values[column] = fromRow;
    } else if (fallback !== undefined) {
      values[column] = fallback;
    } else if (column === "html" || column === "css") {
      values[column] = "";
    } else {
      values[column] = null;
    }
  }

  return values;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  const client = new Client()
    .setEndpoint(requireEnv("APPWRITE_ENDPOINT"))
    .setProject(requireEnv("APPWRITE_PROJECT_ID"))
    .setKey(requireEnv("APPWRITE_API_KEY"));

  const tables = new TablesDB(client);
  const databaseId = requireEnv("APPWRITE_DATABASE_ID");
  const tableId = process.env.APPWRITE_TEMPLATES_TABLE_ID || "templates";

  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: requireEnv("DATABASE_URL") });

  try {
    const response = await tables.listRows({
      databaseId,
      tableId,
      queries: [Query.limit(500)],
    });

    const rows = response.rows as unknown as AppwriteTemplateRow[];
    console.log(`appwrite templates found: ${rows.length}`);

    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      const values = toImportableValues(row);
      const title = String(values.title ?? "").trim();

      if (!title) {
        console.log(`skip ${row.$id}: empty title`);
        skipped += 1;
        continue;
      }

      const existing = await pool.query(
        "select id from templates where user_id is null and title = $1 limit 1",
        [title],
      );

      if (existing.rowCount && existing.rowCount > 0) {
        console.log(`skip ${row.$id}: shared template "${title}" already present`);
        skipped += 1;
        continue;
      }

      if (dryRun) {
        console.log(`would import ${row.$id}: "${title}"`);
        imported += 1;
        continue;
      }

      const insert = await pool.query(
        `insert into templates
           (user_id, title, description, tags, html, css, test_data, orientation,
            paper_size, margin_top, margin_right, margin_bottom, margin_left)
         values (null, $1, $2, $3::text[], $4, $5, $6, $7, $8, $9, $10, $11, $12)
         returning id`,
        [
          title,
          values.description,
          values.tags,
          values.html,
          values.css,
          values.test_data,
          values.orientation,
          values.paper_size,
          values.margin_top,
          values.margin_right,
          values.margin_bottom,
          values.margin_left,
        ],
      );

      console.log(`imported ${row.$id} -> ${insert.rows[0].id}: "${title}"`);
      imported += 1;
    }

    const verification = await pool.query(
      "select count(*)::int as total from templates where user_id is null",
    );

    console.log(
      `\n${dryRun ? "dry run: " : ""}imported=${imported} skipped=${skipped} ` +
        `shared_templates_now=${verification.rows[0].total}`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`import-appwrite-templates: ${message}`);
  process.exitCode = 1;
});
