import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  runPostgresAuthMigrations,
  ensurePostgresAuthSchema,
  resetAuthSchemaCacheForTests,
} from '../src/backend/postgres/auth/migrate.ts';

const sql = readFileSync('scripts/migrations/002-auth.sql', 'utf8');

test('the auth migration creates every auth table idempotently', () => {
  for (const table of [
    'auth_users',
    'auth_sessions',
    'auth_password_reset_tokens',
    'auth_api_keys',
    'auth_oauth_codes',
    'auth_oauth_tokens',
  ]) {
    assert.match(sql, new RegExp(`create table if not exists ${table}`, 'i'));
  }
  assert.ok(!/drop /i.test(sql), 'the migration must never drop anything');
});

test('every token table stores a strong one-way hash and is bound to an owner and an expiry', () => {
  for (const table of ['auth_sessions', 'auth_password_reset_tokens', 'auth_api_keys', 'auth_oauth_codes', 'auth_oauth_tokens']) {
    const tableSql = sql.slice(sql.indexOf(table));
    const body = tableSql.slice(0, tableSql.indexOf(');'));
    assert.match(body, /user_id .* not null/i, `${table} rows must be bound to an owner`);
    assert.match(body, /expires_at/i, `${table} rows must carry an expiry`);
    assert.match(body, /_hash/, `${table} must store a hash, not a plaintext secret`);
  }
  assert.match(sql, /password_hash/, 'passwords are stored as a hash column');
  assert.ok(!/password text/i.test(sql), 'no recoverable plaintext password column exists');
});

test('the migration runner executes the script as one idempotent batch', async () => {
  const executor = fakeQueryer(() => []);
  await runPostgresAuthMigrations(executor, sql);
  await runPostgresAuthMigrations(executor, sql);

  assert.equal(executor.calls.length, 2);
  assert.equal(executor.calls[0].text, sql);
});

test('the lazily-wired repositories ensure the auth schema once per process', async () => {
  resetAuthSchemaCacheForTests();
  const executor = fakeQueryer(() => []);

  await ensurePostgresAuthSchema(executor);
  await ensurePostgresAuthSchema(executor);
  await ensurePostgresAuthSchema(executor);

  assert.equal(executor.calls.length, 1, 'repeated ensure calls must not re-run the migration');
  resetAuthSchemaCacheForTests();
});

function fakeQueryer(plan = () => []) {
  const calls = [];
  return {
    calls,
    async query(text, values = []) {
      calls.push({ text, values });
      const rows = plan({ text, values, call: calls.length - 1 });
      return { rows: rows ?? [] };
    },
  };
}
