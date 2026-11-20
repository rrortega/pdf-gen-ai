import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createPostgresAuthSessionRepository,
  createPostgresApiKeyRepository,
  createPostgresPasswordResetTokenRepository,
} from '../src/backend/postgres/auth/repositories.ts';
import { generateOpaqueToken, hashTokenSecret } from '../src/backend/auth/tokens.ts';

/** A scripted queryer that records every query and returns queued rows per call. */
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

test('opaque tokens are long, url-safe and never repeat', () => {
  const a = generateOpaqueToken();
  const b = generateOpaqueToken();

  assert.ok(a.length >= 40);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(a, b);
});

test('token secrets are stored only as strong one-way hashes', async () => {
  const queryer = fakeQueryer(({ call }) =>
    call === 0 ? [{ id: 'session-1', expires_at: '2026-12-01T00:00:00.000Z' }] : [],
  );
  const sessions = createPostgresAuthSessionRepository(queryer);

  const issued = await sessions.issue('user-1');

  const insert = queryer.calls[0];
  assert.match(insert.text, /insert into auth_sessions/i);
  const hashIndex = insert.values.indexOf(hashTokenSecret(issued.secret));
  assert.ok(hashIndex !== -1, 'the stored value is the sha-256 of the secret');
  assert.equal(
    insert.values.filter((value) => value === issued.secret).length,
    0,
    'the plaintext session secret is never stored',
  );
});

test('session verification is bound to the owning user and to expiry', async () => {
  const queryer = fakeQueryer(() => [
    { id: 'session-1', user_id: 'user-7', expires_at: '2026-12-01T00:00:00.000Z' },
  ]);
  const sessions = createPostgresAuthSessionRepository(queryer);

  const owner = await sessions.findValidOwner(hashTokenSecret('presented-secret'));

  assert.deepEqual(owner, { sessionId: 'session-1', userId: 'user-7' });
  const select = queryer.calls[0];
  assert.match(select.text, /expires_at > now\(\)/, 'expired sessions must never verify');
  assert.match(select.text, /secret_hash = \$1/);
});

test('unknown or expired sessions verify to null', async () => {
  const queryer = fakeQueryer(() => []);
  const sessions = createPostgresAuthSessionRepository(queryer);

  assert.equal(await sessions.findValidOwner(hashTokenSecret('missing')), null);
});

test('session logout deletes by hash and reports whether a row was removed', async () => {
  const removed = fakeQueryer(() => [{ id: 'session-1' }]);
  assert.equal(
    await createPostgresAuthSessionRepository(removed).deleteBySecretHash(hashTokenSecret('x')),
    true,
  );

  const missing = fakeQueryer(() => []);
  assert.equal(
    await createPostgresAuthSessionRepository(missing).deleteBySecretHash(hashTokenSecret('x')),
    false,
  );
});

test('api keys store a hash plus display prefix, never the plaintext', async () => {
  const queryer = fakeQueryer(() => [{ id: 'key-1', created_at: '2026-01-01T00:00:00.000Z' }]);
  const apiKeys = createPostgresApiKeyRepository(queryer);

  const issued = await apiKeys.issue('user-1', 'ci');

  assert.ok(issued.secret.length >= 40);
  const insert = queryer.calls[0];
  assert.match(insert.text, /insert into auth_api_keys/i);
  assert.ok(insert.values.includes(hashTokenSecret(issued.secret)));
  assert.equal(insert.values.filter((value) => value === issued.secret).length, 0);
  assert.ok(insert.values.includes(issued.keyPrefix));
  assert.equal(issued.id, 'key-1');
});

test('api key verification joins the owning user and honours revocation and expiry', async () => {
  const queryer = fakeQueryer(() => [
    { user_id: 'user-3', email: 'owner@test.dev', name: 'Owner' },
  ]);
  const apiKeys = createPostgresApiKeyRepository(queryer);

  const owner = await apiKeys.findValidOwnerByKeyHash(hashTokenSecret('key'));

  assert.deepEqual(owner, { userId: 'user-3', email: 'owner@test.dev', name: 'Owner' });
  const select = queryer.calls[0];
  assert.match(select.text, /revoked_at is null/i);
  assert.match(select.text, /expires_at is null/i);
  assert.match(select.text, /expires_at > now\(\)/i);
});

test('api key lookup for a revoked or expired key returns null', async () => {
  const queryer = fakeQueryer(() => []);

  assert.equal(
    await createPostgresApiKeyRepository(queryer).findValidOwnerByKeyHash(hashTokenSecret('k')),
    null,
  );
});

test('api key listing is owner scoped', async () => {
  const queryer = fakeQueryer(() => [
    {
      id: 'key-1',
      user_id: 'user-1',
      name: 'ci',
      key_prefix: 'abcd1234',
      created_at: '2026-01-01T00:00:00.000Z',
      revoked_at: null,
      last_used_at: null,
    },
  ]);
  const apiKeys = createPostgresApiKeyRepository(queryer);

  const rows = await apiKeys.listByOwner('user-1');

  assert.equal(rows.length, 1);
  assert.equal(rows[0].user_id, 'user-1');
  assert.match(queryer.calls[0].text, /user_id = \$1/);
});

test('revoking an api key is owner scoped and refuses a second revoke', async () => {
  const first = fakeQueryer(() => [{ id: 'key-1' }]);
  assert.equal(
    await createPostgresApiKeyRepository(first).revoke('user-1', 'key-1'),
    true,
  );
  const revokeSql = first.calls[0].text;
  assert.match(revokeSql, /id = \$1/);
  assert.match(revokeSql, /user_id = \$2/, 'one owner can never revoke another owner key');
  assert.match(revokeSql, /revoked_at is null/i, 'an already-revoked key cannot be revoked again');

  const second = fakeQueryer(() => []);
  assert.equal(
    await createPostgresApiKeyRepository(second).revoke('user-2', 'key-1'),
    false,
  );
});

test('password reset tokens expire and are single-use at the SQL level', async () => {
  const before = Date.now();
  const issueQueryer = fakeQueryer(() => [
    { id: 'reset-1', expires_at: new Date(before + 3600_000).toISOString() },
  ]);
  const resetTokens = createPostgresPasswordResetTokenRepository(issueQueryer);

  const issued = await resetTokens.issue('user-1');

  assert.ok(issued.secret.length >= 40);
  assert.equal(
    issueQueryer.calls[0].values.filter((value) => value === issued.secret).length,
    0,
    'the plaintext reset secret is never stored',
  );
  const insert = issueQueryer.calls[0];
  assert.match(insert.text, /insert into auth_password_reset_tokens/i);
  assert.equal(
    Math.abs(new Date(issued.expiresAt).getTime() - (before + 3600_000)) < 5000,
    true,
    'default reset window is one hour',
  );

  const consume = fakeQueryer(() => [{ user_id: 'user-1' }]);
  const result = await createPostgresPasswordResetTokenRepository(consume).consume(
    hashTokenSecret(issued.secret),
  );
  assert.deepEqual(result, { userId: 'user-1' });
  assert.match(consume.calls[0].text, /used_at is null/i);
  assert.match(consume.calls[0].text, /expires_at > now\(\)/);

  const consumed = fakeQueryer(() => []);
  assert.equal(
    await createPostgresPasswordResetTokenRepository(consumed).consume(
      hashTokenSecret(issued.secret),
    ),
    null,
    'the second use of a single-use token must fail',
  );
});
