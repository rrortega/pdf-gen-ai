import { readFileSync } from "node:fs";
import path from "node:path";
import type { Queryer } from "../../auth-contracts";

const MIGRATION_FILE = "002-auth.sql";

/**
 * Runs the idempotent authentication migration script. Safe to call on every
 * deployment start: every statement uses IF NOT EXISTS and nothing is dropped.
 */
export async function runPostgresAuthMigrations(
  executor: Queryer,
  sql: string = readFileSync(
    path.join(process.cwd(), "scripts", "migrations", MIGRATION_FILE),
    "utf8",
  ),
): Promise<void> {
  await executor.query(sql);
}

/**
 * Per-process guard so lazily-wired repositories ensure the schema exactly
 * once. The migration itself is idempotent, so a second process (or a reset)
 * just runs cheap no-op statements.
 */
let ensured: Promise<void> | null = null;

export function ensurePostgresAuthSchema(executor: Queryer): Promise<void> {
  if (!ensured) {
    ensured = runPostgresAuthMigrations(executor).catch((error) => {
      ensured = null;
      throw error;
    });
  }
  return ensured;
}

/** Test hook: clears the per-process ensure guard. */
export function resetAuthSchemaCacheForTests(): void {
  ensured = null;
}

/** Default executor wiring used when repositories lazily resolve the pool. */
export async function runPostgresAuthMigrationsWithPool(): Promise<void> {
  // Lazy import keeps Appwrite deployments independent of pg configuration.
  const { getPool } = await import("../../db");
  await runPostgresAuthMigrations(getPool());
}
