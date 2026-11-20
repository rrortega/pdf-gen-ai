import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashPassword, verifyPassword } from '../src/backend/auth/password.ts';

test('scrypt hash verifies the correct password and rejects a wrong one', async () => {
  const stored = await hashPassword('correct horse battery staple');

  assert.equal(await verifyPassword('correct horse battery staple', stored), true);
  assert.equal(await verifyPassword('correct horse battery staple ', stored), false);
});

test('stored hash never contains the plaintext password and salts are unique', async () => {
  const first = await hashPassword('s3cret-pa55word');
  const second = await hashPassword('s3cret-pa55word');

  assert.ok(!first.includes('s3cret-pa55word'));
  assert.ok(!second.includes('s3cret-pa55word'));
  assert.notEqual(first, second, 'the same password must hash differently per random salt');
  assert.equal(await verifyPassword('s3cret-pa55word', first), true);
  assert.equal(await verifyPassword('s3cret-pa55word', second), true);
});

test('verifyPassword answers false (never throws) for malformed stored hashes', async () => {
  for (const stored of ['', 'plaintext', 'scrypt', 'scrypt$16384$8$1$only-salt', 'bcrypt$abc$def']) {
    assert.equal(await verifyPassword('whatever', stored), false, `stored=${stored}`);
  }
});

test('stored format keeps only one-way scrypt material (params, salt, derived key)', async () => {
  const stored = await hashPassword('hunter2');
  const parts = stored.split('$');

  assert.equal(parts[0], 'scrypt');
  assert.equal(parts.length, 6, 'scrypt$N$r$p$salt$hash');
  for (const part of parts.slice(1)) {
    assert.match(part, /^[A-Za-z0-9+/=]+$/, 'every field is base64 or a numeric parameter');
  }
});

test('unicode passwords round-trip', async () => {
  const stored = await hashPassword('contraseña-超安全的-🔐');

  assert.equal(await verifyPassword('contraseña-超安全的-🔐', stored), true);
  assert.equal(await verifyPassword('contraseña-超安全的-🔓', stored), false);
});
