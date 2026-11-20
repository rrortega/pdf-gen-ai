import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { createPostgresAuthHttp } from '../src/backend/postgres/auth/http.ts';

function post(path, body, headers = {}) {
  return new NextRequest(
    new Request(`http://localhost:3030${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
  );
}

function get(path, headers = {}) {
  return new NextRequest(new Request(`http://localhost:3030${path}`, { headers }));
}

function fakeProvider(overrides = {}) {
  return {
    async register() {
      return {
        principal: { id: 'user-1', email: 'a@test.dev', name: 'Ana', isApiKey: false },
        sessionId: 'session-1',
        sessionSecret: 'opaque-session-secret-value-1234567890abcdef',
        sessionProvider: 'email',
      };
    },
    async login() {
      return {
        principal: { id: 'user-1', email: 'a@test.dev', name: 'Ana', isApiKey: false },
        sessionId: 'session-1',
        sessionSecret: 'opaque-session-secret-value-1234567890abcdef',
        sessionProvider: 'email',
      };
    },
    async logoutSession() {},
    async verifySessionSecret() { return null; },
    async requestRecovery() {},
    async confirmRecovery() {},
    async listApiKeysFor() { return { total: 0, items: [] }; },
    async createApiKeyFor() { return { id: 'key-1', secret: 'k'.repeat(43), createdAt: '2026-01-01T00:00:00.000Z' }; },
    async revokeApiKeyFor() {},
    ...overrides,
  };
}

const mailer = { async sendPasswordResetEmail() {} };

test('register keeps the legacy response shape and sets the legacy session cookie', async () => {
  const http = createPostgresAuthHttp({ provider: fakeProvider(), mailer, env: {} });

  const response = await http.registerPostgres(
    post('/api/v1/auth/register', { email: 'a@test.dev', password: 'p'.repeat(12), name: 'Ana' }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    success: true,
    session: { id: 'session-1', userId: 'user-1', provider: 'email' },
    user: { id: 'user-1', email: 'a@test.dev', name: 'Ana', emailVerification: false },
  });
  const setCookie = response.headers.get('set-cookie');
  assert.match(setCookie, /session=opaque-session-secret-value/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=lax/);
  assert.match(setCookie, /Path=\//);
  assert.match(setCookie, /Max-Age=604800/, 'legacy cookie lifetime is 7 days');
});

test('register validates presence exactly like the legacy route', async () => {
  const http = createPostgresAuthHttp({ provider: fakeProvider(), mailer, env: {} });
  for (const body of [{}, { email: 'a' }, { email: 'a', password: 'b' }, { email: 'a', password: 'b', name: '' }]) {
    const response = await http.registerPostgres(post('/api/v1/auth/register', body));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Email, password and name are required' });
  }
});

test('register failures map to the legacy 400 error shape', async () => {
  const http = createPostgresAuthHttp({
    provider: fakeProvider({ async register() { throw new Error('User already exists'); } }),
    mailer,
    env: {},
  });

  const response = await http.registerPostgres(
    post('/api/v1/auth/register', { email: 'a@test.dev', password: 'p'.repeat(12), name: 'Ana' }),
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'User already exists' });
});

test('login keeps the legacy response shape', async () => {
  const http = createPostgresAuthHttp({ provider: fakeProvider(), mailer, env: {} });

  const response = await http.loginPostgres(
    post('/api/v1/auth/login', { email: 'a@test.dev', password: 'p'.repeat(12) }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    success: true,
    session: { id: 'session-1', userId: 'user-1', provider: 'email' },
    user: { id: 'user-1', email: 'a@test.dev', name: 'Ana', emailVerification: false },
  });
  assert.match(response.headers.get('set-cookie'), /session=/);
});

test('login validates missing fields with 400 and bad credentials with 401', async () => {
  const http = createPostgresAuthHttp({
    provider: fakeProvider({ async login() { throw new Error('Invalid email or password'); } }),
    mailer,
    env: {},
  });

  const missing = await http.loginPostgres(post('/api/v1/auth/login', {}));
  assert.equal(missing.status, 400);
  assert.deepEqual(await missing.json(), { error: 'Email and password are required' });

  const bad = await http.loginPostgres(post('/api/v1/auth/login', { email: 'a@test.dev', password: 'nope' }));
  assert.equal(bad.status, 401);
  assert.deepEqual(await bad.json(), { error: 'Invalid email or password' });
});

test('logout keeps the legacy shape and clears the cookie', async () => {
  const loggedOut = [];
  const http = createPostgresAuthHttp({
    provider: fakeProvider({
      async logoutSession(secret) { loggedOut.push(secret); },
      async verifySessionSecret() { return { id: 'user-1', email: 'a@test.dev', isApiKey: false }; },
    }),
    mailer,
    env: {},
  });

  const response = await http.logoutPostgres(
    post('/api/v1/auth/logout', {}, { cookie: 'session=opaque-session-secret-value-1234567890abcdef' }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { success: true, message: 'Logged out successfully' });
  assert.deepEqual(loggedOut, ['opaque-session-secret-value-1234567890abcdef']);
  assert.match(response.headers.get('set-cookie'), /session=;/);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
});

test('me returns the legacy shape with a locally issued JWT', async () => {
  const jwtVerify = (await import('jose')).jwtVerify;
  const http = createPostgresAuthHttp({
    provider: fakeProvider(),
    mailer,
    env: {},
    authenticate: async () => ({ id: 'user-1', email: 'a@test.dev', name: 'Ana', isApiKey: false }),
  });

  const response = await http.mePostgres(get('/api/v1/auth/me'));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.deepEqual(body.user, { id: 'user-1', email: 'a@test.dev', name: 'Ana', emailVerification: false });
  assert.equal(typeof body.jwt, 'string');
  const { payload } = await jwtVerify(body.jwt, new TextEncoder().encode('default-secret-change-me'));
  assert.equal(payload.userId, 'user-1');
});

test('me answers 401 with the legacy body when unauthenticated', async () => {
  const http = createPostgresAuthHttp({
    provider: fakeProvider(),
    mailer,
    env: {},
    authenticate: async () => null,
  });

  const response = await http.mePostgres(get('/api/v1/auth/me'));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Not authenticated' });
});

test('recovery request keeps the legacy shapes', async () => {
  const http = createPostgresAuthHttp({ provider: fakeProvider(), mailer, env: {} });

  const missing = await http.requestRecoveryPostgres(post('/api/v1/auth/recovery', {}));
  assert.equal(missing.status, 400);
  assert.deepEqual(await missing.json(), { success: false, error: 'Email is required' });

  const ok = await http.requestRecoveryPostgres(post('/api/v1/auth/recovery', { email: 'a@test.dev' }));
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { success: true, message: 'Recovery email sent. Please check your inbox.' });
});

test('recovery confirm keeps the legacy validation order and status codes', async () => {
  const http = createPostgresAuthHttp({ provider: fakeProvider(), mailer, env: {} });

  const missing = await http.confirmRecoveryPostgres(post('/api/v1/auth/recovery/confirm', {}));
  assert.equal(missing.status, 400);
  assert.deepEqual(await missing.json(), { success: false, error: 'All fields are required' });

  const mismatch = await http.confirmRecoveryPostgres(
    post('/api/v1/auth/recovery/confirm', { userId: 'u', secret: 's', password: '12345678', passwordConfirm: '87654321' }),
  );
  assert.equal(mismatch.status, 400);
  assert.deepEqual(await mismatch.json(), { success: false, error: 'Passwords do not match' });

  const short = await http.confirmRecoveryPostgres(
    post('/api/v1/auth/recovery/confirm', { userId: 'u', secret: 's', password: '1234567', passwordConfirm: '1234567' }),
  );
  assert.equal(short.status, 400);
  assert.deepEqual(await short.json(), { success: false, error: 'Password must be at least 8 characters' });

  const ok = await http.confirmRecoveryPostgres(
    post('/api/v1/auth/recovery/confirm', { userId: 'u', secret: 's', password: '12345678', passwordConfirm: '12345678' }),
  );
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), {
    success: true,
    message: 'Password reset successful. You can now login with your new password.',
  });
});

test('recovery confirm keeps the legacy 500 status for an invalid or expired token', async () => {
  const http = createPostgresAuthHttp({
    provider: fakeProvider({ async confirmRecovery() { throw new Error('Invalid or expired reset token'); } }),
    mailer,
    env: {},
  });

  const response = await http.confirmRecoveryPostgres(
    post('/api/v1/auth/recovery/confirm', { userId: 'u', secret: 's', password: '12345678', passwordConfirm: '12345678' }),
  );
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { success: false, error: 'Invalid or expired reset token' });
});

test('api key endpoints require a session and keep the legacy shapes', async () => {
  const authed = 'session=opaque-session-secret-value-1234567890abcdef';
  const http = createPostgresAuthHttp({
    provider: fakeProvider({
      async verifySessionSecret(secret) {
        return secret === 'opaque-session-secret-value-1234567890abcdef'
          ? { id: 'user-1', email: 'a@test.dev', isApiKey: false }
          : null;
      },
      async listApiKeysFor(ownerId) {
        return ownerId === 'user-1'
          ? { total: 1, items: [{ id: 'key-9', name: 'ci', createdAt: '2026-01-01T00:00:00.000Z' }] }
          : { total: 0, items: [] };
      },
    }),
    mailer,
    env: {},
  });

  const unauthGet = await http.apiKeyGetPostgres(get('/api/v1/auth/api-key'));
  assert.equal(unauthGet.status, 401);
  assert.deepEqual(await unauthGet.json(), { error: 'Unauthorized' });

  const unauthPost = await http.apiKeyPostgres(post('/api/v1/auth/api-key', {}));
  assert.equal(unauthPost.status, 401);
  assert.deepEqual(await unauthPost.json(), { error: 'Unauthorized' });

  const list = await http.apiKeyGetPostgres(get('/api/v1/auth/api-key', { cookie: authed }));
  assert.equal(list.status, 200);
  const listed = await list.json();
  assert.equal(listed.success, true);
  assert.equal(listed.apiKey, null, 'hashed keys cannot be re-displayed; the plaintext is shown once at creation');
  assert.deepEqual(listed.keys, [{ id: 'key-9', name: 'ci', createdAt: '2026-01-01T00:00:00.000Z' }]);

  const created = await http.apiKeyPostgres(post('/api/v1/auth/api-key', {}, { cookie: authed }));
  assert.equal(created.status, 200);
  const createdBody = await created.json();
  assert.equal(createdBody.success, true);
  assert.equal(createdBody.apiKey, 'k'.repeat(43));
});

test('api key revoke answers 401, 400, 404 or 200 like an additive DELETE route should', async () => {
  const authed = 'session=opaque-session-secret-value-1234567890abcdef';
  const http = createPostgresAuthHttp({
    provider: fakeProvider({
      async verifySessionSecret() { return { id: 'user-1', email: 'a@test.dev', isApiKey: false }; },
      async revokeApiKeyFor(ownerId, id) {
        return ownerId === 'user-1' && id === 'key-9';
      },
    }),
    mailer,
    env: {},
  });

  const unauth = await http.apiKeyDeletePostgres(post('/api/v1/auth/api-key', { id: 'key-9' }));
  assert.equal(unauth.status, 401);

  const noId = await http.apiKeyDeletePostgres(post('/api/v1/auth/api-key', {}, { cookie: authed }));
  assert.equal(noId.status, 400);

  const missing = await http.apiKeyDeletePostgres(post('/api/v1/auth/api-key', { id: 'other' }, { cookie: authed }));
  assert.equal(missing.status, 404);

  const ok = await http.apiKeyDeletePostgres(post('/api/v1/auth/api-key', { id: 'key-9' }, { cookie: authed }));
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { success: true });
});
