import { readFileSync } from "node:fs";
import path from "node:path";
import type { Queryer } from "../data-contracts";

const MIGRATION_FILE = "001-postgres-data-backend.sql";

/**
 * Runs the idempotent data-backend migration script. Safe to call on every
 * deployment start: every statement uses IF NOT EXISTS and nothing is dropped.
 */
export async function runPostgresDataMigrations(
  executor: Queryer,
  sql: string = readFileSync(
    path.join(process.cwd(), "scripts", "migrations", MIGRATION_FILE),
    "utf8",
  ),
): Promise<void> {
  await executor.query(sql);
}

/** Default executor wiring used by the setup route and worker startup. */
export async function runPostgresDataMigrationsWithPool(): Promise<void> {
  // Lazy import keeps Appwrite deployments independent of pg configuration.
  const { getPool } = await import("../db");
  await runPostgresDataMigrations(getPool());
}
