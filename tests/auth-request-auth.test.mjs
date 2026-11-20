import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { authenticateRequestPostgres } from '../src/backend/postgres/auth/http.ts';

const encoder = new TextEncoder();

function requestWith(headers = {}) {
  return new NextRequest(new Request('http://localhost:3030/api/v1/templates', { headers }));
}

function fakeProvider(overrides = {}) {
  return {
    async verifySessionSecret() { return null; },
    async verifyOAuthAccessToken() { return null; },
    async verifyApiKeySecret() { return null; },
    ...overrides,
  };
}

test('a local JWT bearer token authenticates without any database access', async () => {
  const jwt = await new SignJWT({ userId: 'user-1', email: 'a@test.dev' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(encoder.encode('default-secret-change-me'));

  const principal = await authenticateRequestPostgres(
    requestWith({ authorization: `Bearer ${jwt}` }),
    { provider: fakeProvider() },
  );

  assert.deepEqual(principal, { id: 'user-1', email: 'a@test.dev', isApiKey: true });
});

test('an invalid bearer token authenticates to null without touching Appwrite', async () => {
  const principal = await authenticateRequestPostgres(
    requestWith({ authorization: 'Bearer not-a-jwt' }),
    { provider: fakeProvider() },
  );

  assert.equal(principal, null);
});

test('bearer fallback order: oauth access token, then api key', async () => {
  const calls = [];
  const provider = fakeProvider({
    async verifyOAuthAccessToken(token) {
      calls.push(['oauth', token]);
      return token === 'oauth-token'
        ? { id: 'user-2', email: 'two@test.dev', isApiKey: false }
        : null;
    },
    async verifyApiKeySecret(key) {
      calls.push(['apiKey', key]);
      return key === 'api-key'
        ? { id: 'user-3', email: 'three@test.dev', isApiKey: true }
        : null;
    },
  });

  const viaOauth = await authenticateRequestPostgres(
    requestWith({ authorization: 'Bearer oauth-token' }),
    { provider },
  );
  assert.deepEqual(viaOauth, { id: 'user-2', email: 'two@test.dev', isApiKey: false });

  const viaApiKey = await authenticateRequestPostgres(
    requestWith({ authorization: 'Bearer api-key' }),
    { provider },
  );
  assert.deepEqual(viaApiKey, { id: 'user-3', email: 'three@test.dev', isApiKey: true });

  assert.deepEqual(calls, [
    ['oauth', 'oauth-token'],
    ['oauth', 'api-key'],
    ['apiKey', 'api-key'],
  ]);
});

test('the legacy session cookie authenticates through the opaque session store', async () => {
  const provider = fakeProvider({
    async verifySessionSecret(secret) {
      return secret === 'session-secret-value'
        ? { id: 'user-4', email: 'four@test.dev', name: 'Four', isApiKey: false }
        : null;
    },
  });

  const principal = await authenticateRequestPostgres(
    requestWith({ cookie: 'session=session-secret-value' }),
    { provider },
  );

  assert.deepEqual(principal, { id: 'user-4', email: 'four@test.dev', name: 'Four', isApiKey: false });
});

test('no credentials at all authenticates to null', async () => {
  const principal = await authenticateRequestPostgres(requestWith(), {
    provider: fakeProvider(),
  });
  assert.equal(principal, null);
});
