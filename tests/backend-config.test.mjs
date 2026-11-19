import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backendProvider } from '../src/backend/config.ts';

test('defaults to Appwrite so legacy deployments keep their backend', () => {
  assert.equal(backendProvider({}), 'appwrite');
  assert.equal(backendProvider({ BACKEND_PROVIDER: 'appwrite' }), 'appwrite');
});

test('selects the self-hosted backend with one environment variable', () => {
  assert.equal(backendProvider({ BACKEND_PROVIDER: 'postgres' }), 'postgres');
});

test('rejects invalid providers instead of silently using a different data store', () => {
  for (const BACKEND_PROVIDER of ['', 'postgresql', 'POSTGRES']) {
    assert.throws(() => backendProvider({ BACKEND_PROVIDER }), {
      message: 'BACKEND_PROVIDER must be appwrite or postgres',
    });
  }
});
