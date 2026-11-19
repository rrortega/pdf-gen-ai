import assert from 'node:assert/strict';
import { test } from 'node:test';

test('loading the database module does not require PostgreSQL configuration', async () => {
  const databaseUrl = process.env.DATABASE_URL;

  try {
    delete process.env.DATABASE_URL;
    const db = await import('../src/backend/db.ts');

    assert.throws(() => db.getPool(), {
      message: 'DATABASE_URL is required for the postgres backend',
    });
  } finally {
    if (databaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = databaseUrl;
    }
  }
});

test('creates and closes a pool lazily without opening a database connection', async () => {
  const databaseUrl = process.env.DATABASE_URL;
  const db = await import('../src/backend/db.ts');

  try {
    process.env.DATABASE_URL = 'postgres://user:password@localhost:5432/pdf4ia';

    const pool = db.getPool();

    assert.equal(pool.options.connectionString, process.env.DATABASE_URL);
    assert.equal(db.getPool(), pool);
  } finally {
    await db.closePool();

    if (databaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = databaseUrl;
    }
  }
});
