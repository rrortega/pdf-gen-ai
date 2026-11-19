import { Pool, type PoolClient } from "pg";

let pool: Pool | undefined;

/**
 * Returns the process-wide PostgreSQL pool on first use.
 *
 * Importing this module does not read DATABASE_URL, construct a Pool, or open a
 * connection. This keeps the default Appwrite deployment independent of
 * PostgreSQL configuration.
 */
export function getPool(): Pool {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for the postgres backend");
  }

  pool = new Pool({ connectionString });
  return pool;
}

/**
 * Closes the lazily-created pool, if one exists, and permits a later fresh pool.
 */
export async function closePool(): Promise<void> {
  const currentPool = pool;
  pool = undefined;

  if (currentPool) {
    await currentPool.end();
  }
}

/**
 * Runs work in a transaction, committing only after the callback succeeds.
 * The client is always rolled back on failure and released before this returns.
 */
export async function transaction<T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
