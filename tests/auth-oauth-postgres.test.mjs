import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createPostgresOAuthCodeRepository,
  createPostgresOAuthTokenRepository,
} from '../src/backend/postgres/auth/repositories.ts';
import { hashTokenSecret } from '../src/backend/auth/tokens.ts';

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

test('oauth codes are stored hashed, expire in ten minutes and are single-use', async () => {
  const issueQueryer = fakeQueryer(() => [
    { id: 'code-1', expires_at: '2026-01-01T00:10:00.000Z' },
  ]);
  const codes = createPostgresOAuthCodeRepository(issueQueryer);

  const issued = await codes.issue({
    clientId: 'client-1',
    userId: 'user-1',
    redirectUri: 'https://app.test/cb',
    scopes: ['read'],
    codeChallenge: 'challenge',
    codeChallengeMethod: 'S256',
  });

  assert.ok(issued.secret.length >= 40);
  const insert = issueQueryer.calls[0];
  assert.match(insert.text, /insert into auth_oauth_codes/i);
  assert.ok(insert.values.includes(hashTokenSecret(issued.secret)));
  assert.equal(
    insert.values.filter((value) => value === issued.secret).length,
    0,
    'the plaintext authorization code is never stored',
  );
  assert.equal(issued.expiresAt, '2026-01-01T00:10:00.000Z');

  const consume = fakeQueryer(() => [
    {
      id: 'code-1',
      client_id: 'client-1',
      user_id: 'user-1',
      redirect_uri: 'https://app.test/cb',
      scopes: ['read'],
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
      expires_at: '2026-01-01T00:10:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
    },
  ]);
  const row = await createPostgresOAuthCodeRepository(consume).consume(issued.secret);
  assert.equal(row.client_id, 'client-1');
  assert.equal(row.user_id, 'user-1');
  assert.match(consume.calls[0].text, /consumed_at is null/i);
  assert.match(consume.calls[0].text, /expires_at > now\(\)/);

  const reused = fakeQueryer(() => []);
  assert.equal(await createPostgresOAuthCodeRepository(reused).consume(issued.secret), null);
});

test('oauth access tokens are returned once and stored hashed', async () => {
  const queryer = fakeQueryer(() => [{ id: 'tok-1', expires_at: '2026-01-01T01:00:00.000Z' }]);
  const tokens = createPostgresOAuthTokenRepository(queryer);

  const issued = await tokens.issue({ clientId: 'client-1', userId: 'user-1', scopes: ['read', 'write'] });

  assert.equal(issued.token_type, 'Bearer');
  assert.equal(issued.expires_in, 3600);
  assert.equal(issued.scope, 'read write');
  assert.ok(issued.refresh_token?.length >= 40);
  const insert = queryer.calls[0];
  assert.match(insert.text, /insert into auth_oauth_tokens/i);
  assert.ok(insert.values.includes(hashTokenSecret(issued.access_token)));
  assert.ok(insert.values.includes(hashTokenSecret(issued.refresh_token)));
  assert.equal(
    insert.values.filter((value) => value === issued.access_token || value === issued.refresh_token).length,
    0,
    'access and refresh tokens are never stored as plaintext',
  );
});

test('expired or unknown access tokens do not verify', async () => {
  const queryer = fakeQueryer(() => []);
  const tokens = createPostgresOAuthTokenRepository(queryer);

  assert.equal(await tokens.findValidByAccessToken('missing'), null);
});

test('valid access tokens verify with owner binding enforced by expiry SQL', async () => {
  const queryer = fakeQueryer(() => [
    {
      id: 'tok-1',
      client_id: 'client-1',
      user_id: 'user-1',
      scopes: ['read'],
      expires_at: '2026-01-01T01:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
    },
  ]);
  const tokens = createPostgresOAuthTokenRepository(queryer);

  const row = await tokens.findValidByAccessToken('the-token');

  assert.equal(row.user_id, 'user-1');
  assert.match(queryer.calls[0].text, /expires_at > now\(\)/);
  assert.match(queryer.calls[0].text, /access_token_hash = \$1/);
});

test('refresh rotation deletes the old token row and issues one for the same owner and scopes', async () => {
  const queryer = fakeQueryer(({ call }) =>
    call === 0
      ? [{ client_id: 'client-1', user_id: 'user-1', scopes: ['read'] }]
      : [{ id: 'tok-2', expires_at: '2026-01-01T01:00:00.000Z' }],
  );
  const tokens = createPostgresOAuthTokenRepository(queryer);

  const rotated = await tokens.rotateByRefreshToken('old-refresh-token');

  assert.equal(rotated.token_type, 'Bearer');
  assert.equal(rotated.scope, 'read');
  assert.notEqual(rotated.access_token, 'old-refresh-token');
  const deleted = queryer.calls[0];
  assert.match(deleted.text, /delete from auth_oauth_tokens/i);
  assert.match(deleted.text, /refresh_token_hash = \$1/);
  const insert = queryer.calls[1];
  assert.match(insert.text, /insert into auth_oauth_tokens/i);

  const unknown = fakeQueryer(() => []);
  assert.equal(
    await createPostgresOAuthTokenRepository(unknown).rotateByRefreshToken('unknown'),
    null,
  );
});

test('revoke matches either the access or the refresh hash and reports success', async () => {
  const hit = fakeQueryer(() => [{ id: 'tok-1' }]);
  assert.equal(await createPostgresOAuthTokenRepository(hit).revokeAny('some-token'), true);
  assert.match(hit.calls[0].text, /access_token_hash = \$1/);
  assert.match(hit.calls[0].text, /refresh_token_hash = \$1/);

  const miss = fakeQueryer(() => []);
  assert.equal(await createPostgresOAuthTokenRepository(miss).revokeAny('some-token'), false);
});
