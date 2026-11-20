import type { Queryer, TemplateRepository, TemplateRow } from "../data-contracts";

type TemplateQueryer = Queryer;

interface TemplateSqlRow {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  tags: string[] | null;
  html: string;
  css: string;
  test_data: string | null;
  orientation: string;
  paper_size: string;
  margin_top: string;
  margin_right: string;
  margin_bottom: string;
  margin_left: string;
  created_at: Date | string;
  updated_at: Date | string;
}

const COLUMNS = `id, user_id, title, description, tags, html, css, test_data, orientation,
  paper_size, margin_top, margin_right, margin_bottom, margin_left, created_at, updated_at`;

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toRow(sql: TemplateSqlRow): TemplateRow {
  return {
    $id: sql.id,
    user_id: sql.user_id,
    title: sql.title,
    description: sql.description,
    tags: sql.tags ?? [],
    html: sql.html,
    css: sql.css,
    test_data: sql.test_data ?? "",
    orientation: sql.orientation,
    paper_size: sql.paper_size,
    margin_top: sql.margin_top,
    margin_right: sql.margin_right,
    margin_bottom: sql.margin_bottom,
    margin_left: sql.margin_left,
    $createdAt: toIso(sql.created_at),
    $updatedAt: toIso(sql.updated_at),
  };
}

/**
 * Creates the PostgreSQL template repository. Every owner-scoped query filters
 * by `user_id`; `getById` is reserved for the background worker (system
 * principal) and must never be exposed through an HTTP route.
 */
export function createPostgresTemplateRepository(queryer?: TemplateQueryer): TemplateRepository {
  let db: TemplateQueryer | undefined = queryer;

  async function getDb(): Promise<TemplateQueryer> {
    if (!db) {
      // Lazy so importing this module never requires DATABASE_URL.
      const { getPool } = await import("../db");
      db = getPool();
    }
    return db;
  }

  return {
    async list(options) {
      const values: unknown[] = [];
      const where: string[] = [];

      if (options.base) {
        where.push("user_id IS NULL");
      } else {
        values.push(options.ownerId);
        where.push(`user_id = $${values.length}`);
      }

      if (options.search) {
        values.push(`%${options.search}%`);
        where.push(`title ILIKE $${values.length}`);
      }

      if (options.tags && options.tags.length > 0) {
        values.push(options.tags);
        where.push(`tags && $${values.length}::text[]`);
      }

      if (options.ids && options.ids.length > 0) {
        values.push(options.ids);
        where.push(`id = ANY($${values.length}::text[])`);
      }

      const limit = options.limit ?? 100;
      const offset = options.offset ?? 0;
      const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

      values.push(limit);
      const limitIndex = values.length;
      values.push(offset);
      const offsetIndex = values.length;

      const listResult = await (await getDb()).query(
        `SELECT ${COLUMNS}, COUNT(*) OVER()::int AS total_count
         FROM templates ${whereSql}
         ORDER BY created_at DESC
         LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
        values,
      );

      return {
        total: Number(listResult.rows[0]?.total_count ?? 0),
        rows: listResult.rows.map((row) => toRow(row as unknown as TemplateSqlRow)),
      };
    },

    async get(ownerId, id) {
      const result = await (await getDb()).query(
        `SELECT ${COLUMNS} FROM templates WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [id, ownerId],
      );
      const row = result.rows[0];
      return row ? toRow(row as unknown as TemplateSqlRow) : null;
    },

    async exists(id) {
      const result = await (await getDb()).query(`SELECT 1 FROM templates WHERE id = $1 LIMIT 1`, [id]);
      return result.rows.length > 0;
    },

    async getById(id) {
      const result = await (await getDb()).query(
        `SELECT ${COLUMNS} FROM templates WHERE id = $1 LIMIT 1`,
        [id],
      );
      const row = result.rows[0];
      return row ? toRow(row as unknown as TemplateSqlRow) : null;
    },

    async create(ownerId, input) {
      const result = await (await getDb()).query(
        `INSERT INTO templates
          (user_id, title, description, tags, html, css, test_data, orientation,
           paper_size, margin_top, margin_right, margin_bottom, margin_left)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING ${COLUMNS}`,
        [
          ownerId,
          input.title,
          input.description ?? null,
          input.tags ?? [],
          input.html,
          input.css,
          input.test_data,
          input.orientation,
          input.paper_size,
          input.margin_top,
          input.margin_right,
          input.margin_bottom,
          input.margin_left,
        ],
      );
      if (!result.rows[0]) {
        throw new Error(`template insert returned no row for owner ${ownerId}`);
      }
      return toRow(result.rows[0] as unknown as TemplateSqlRow);
    },

    async update(ownerId, id, input) {
      const values: unknown[] = [];
      const sets: string[] = [];

      const assign = (column: string, value: unknown) => {
        values.push(value);
        sets.push(`${column} = $${values.length}`);
      };

      assign("title", input.title);
      if (input.tags !== undefined) assign("tags", input.tags);
      if (input.css !== undefined) assign("css", input.css);
      if (input.html !== undefined) assign("html", input.html);
      if (input.test_data !== undefined) assign("test_data", input.test_data);
      if (input.orientation !== undefined) assign("orientation", input.orientation);
      if (input.paper_size !== undefined) assign("paper_size", input.paper_size);
      if (input.margin_top !== undefined) assign("margin_top", input.margin_top);
      if (input.margin_right !== undefined) assign("margin_right", input.margin_right);
      if (input.margin_bottom !== undefined) assign("margin_bottom", input.margin_bottom);
      if (input.margin_left !== undefined) assign("margin_left", input.margin_left);
      values.push(id);
      const idIndex = values.length;
      values.push(ownerId);
      const ownerIndex = values.length;

      const result = await (await getDb()).query(
        `UPDATE templates SET ${sets.join(", ")}, updated_at = now()
         WHERE id = $${idIndex} AND user_id = $${ownerIndex}
         RETURNING ${COLUMNS}`,
        values,
      );
      const row = result.rows[0];
      return row ? toRow(row as unknown as TemplateSqlRow) : null;
    },

    async delete(ownerId, id) {
      const result = await (await getDb()).query(
        `DELETE FROM templates WHERE id = $1 AND user_id = $2 RETURNING id`,
        [id, ownerId],
      );
      return result.rows.length > 0;
    },
  };
}
