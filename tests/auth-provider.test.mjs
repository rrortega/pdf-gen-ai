import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPostgresAuthProvider } from '../src/backend/postgres/auth/provider.ts';

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

function noopMailer() {
  const sent = [];
  return {
    sent,
    async sendPasswordResetEmail(to, resetUrl) {
      sent.push({ to, resetUrl });
    },
  };
}

test('register stores only a scrypt hash, never the plaintext password', async () => {
  const queryer = fakeQueryer(({ call }) => {
    if (call === 0) return []; // findByEmail: no existing user
    if (call === 1) {
      return [
        {
          id: 'user-1',
          email: 'a@test.dev',
          name: 'Ana',
          password_hash: 'scrypt$hash',
          email_verification: false,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ];
    }
    return [{ id: 'session-1', expires_at: '2026-12-01T00:00:00.000Z' }]; // session issue
  });
  const provider = createPostgresAuthProvider(queryer, { mailer: noopMailer() });

  const result = await provider.register({
    email: 'a@test.dev',
    password: 'super-secret-pass',
    name: 'Ana',
  });

  assert.equal(result.principal.email, 'a@test.dev');
  assert.equal(result.principal.name, 'Ana');
  assert.ok(result.sessionSecret.length >= 40);
  const userInsert = queryer.calls[1];
  assert.match(userInsert.text, /insert into auth_users/i);
  assert.equal(
    userInsert.values.filter((value) => value === 'super-secret-pass').length,
    0,
    'the plaintext password must never reach the database',
  );
  assert.ok(userInsert.values.some((value) => typeof value === 'string' && value.startsWith('scrypt$')));
});

test('register rejects an already registered email', async () => {
  const queryer = fakeQueryer(() => [
    {
      id: 'user-1',
      email: 'a@test.dev',
      name: 'Ana',
      password_hash: 'scrypt$hash',
      email_verification: false,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
  ]);
  const provider = createPostgresAuthProvider(queryer, { mailer: noopMailer() });

  await assert.rejects(
    () => provider.register({ email: 'a@test.dev', password: 'x'.repeat(12), name: 'Ana' }),
    { message: 'User already exists' },
  );
});

test('login verifies the scrypt hash and issues a session; wrong password never issues one', async () => {
  const password = 'super-secret-pass';
  const storedHash = await (async () => {
    const { hashPassword } = await import('../src/backend/auth/password.ts');
    return hashPassword(password);
  })();
  const userRow = {
    id: 'user-1',
    email: 'a@test.dev',
    name: 'Ana',
    password_hash: storedHash,
    email_verification: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };

  const good = fakeQueryer(({ call }) => (call === 0 ? [userRow] : [{ id: 's1', expires_at: '2026-12-01T00:00:00.000Z' }]));
  const okProvider = createPostgresAuthProvider(good, { mailer: noopMailer() });
  const ok = await okProvider.login({ email: 'a@test.dev', password });
  assert.equal(ok.principal.id, 'user-1');
  assert.ok(ok.sessionSecret.length >= 40);
  assert.match(good.calls[1].text, /insert into auth_sessions/i);

  const bad = fakeQueryer(() => [userRow]);
  const badProvider = createPostgresAuthProvider(bad, { mailer: noopMailer() });
  await assert.rejects(() => badProvider.login({ email: 'a@test.dev', password: 'wrong' }), {
    message: 'Invalid email or password',
  });
  assert.equal(
    bad.calls.filter((call) => /insert into auth_sessions/i.test(call.text)).length,
    0,
    'a failed login must not create a session',
  );

  const missing = fakeQueryer(() => []);
  await assert.rejects(
    () => createPostgresAuthProvider(missing, { mailer: noopMailer() }).login({ email: 'ghost@test.dev', password }),
    { message: 'Invalid email or password' },
  );
  assert.equal(
    missing.calls.filter((call) => /insert into auth_sessions/i.test(call.text)).length,
    0,
  );
});

test('session verification resolves the owning principal only', async () => {
  const queryer = fakeQueryer(({ call }) =>
    call === 0
      ? [{ id: 'session-1', user_id: 'user-9', expires_at: '2026-12-01T00:00:00.000Z' }]
      : [
          {
            id: 'user-9',
            email: 'nine@test.dev',
            name: 'Nine',
            password_hash: 'scrypt$hash',
            email_verification: false,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
  );
  const provider = createPostgresAuthProvider(queryer, { mailer: noopMailer() });

  const principal = await provider.verifySessionSecret('presented-secret');

  assert.deepEqual(principal, { id: 'user-9', email: 'nine@test.dev', name: 'Nine', isApiKey: false });
});

test('api key verification returns the key owner flagged as isApiKey', async () => {
  const queryer = fakeQueryer(() => [
    { user_id: 'user-3', email: 'owner@test.dev', name: 'Owner' },
  ]);
  const provider = createPostgresAuthProvider(queryer, { mailer: noopMailer() });

  const principal = await provider.verifyApiKeySecret('the-key');

  assert.deepEqual(principal, { id: 'user-3', email: 'owner@test.dev', name: 'Owner', isApiKey: true });
});

test('api key lifecycle: create returns the plaintext once, list never leaks it, revoke is owner scoped', async () => {
  const provider = createPostgresAuthProvider(
    fakeQueryer(({ call }) => {
      if (call === 0) return [{ id: 'key-9', created_at: '2026-01-01T00:00:00.000Z' }];
      if (call === 1) {
        return [
          {
            id: 'key-9',
            user_id: 'user-1',
            name: 'ci',
            key_prefix: 'abcd1234',
            created_at: '2026-01-01T00:00:00.000Z',
            revoked_at: null,
            last_used_at: null,
          },
        ];
      }
      return [{ id: 'key-9' }];
    }),
    { mailer: noopMailer() },
  );

  const created = await provider.createApiKeyFor('user-1', 'ci');
  assert.equal(created.id, 'key-9');
  assert.ok(created.secret.length >= 40);
  assert.equal(created.createdAt, '2026-01-01T00:00:00.000Z');

  const page = await provider.listApiKeysFor('user-1');
  assert.equal(page.total, 1);
  assert.deepEqual(page.items[0], { id: 'key-9', name: 'ci', createdAt: '2026-01-01T00:00:00.000Z' });
  const listed = JSON.stringify(page);
  assert.ok(!listed.includes(created.secret), 'listing must never return the plaintext key');
  assert.ok(!listed.includes('key_hash'));

  const scoped = fakeQueryer(({ values }) => (values[1] === 'user-1' ? [{ id: 'key-9' }] : []));
  const scopedProvider = createPostgresAuthProvider(scoped, { mailer: noopMailer() });
  await scopedProvider.revokeApiKeyFor('user-1', 'key-9');
  assert.equal(
    await scopedProvider.revokeApiKeyFor('other-owner', 'key-9'),
    false,
    'one owner can never revoke another owner key',
  );
  assert.match(scoped.calls[0].text, /user_id = \$2/, 'the revoke statement filters by owner');
});

test('password reset issues a token and emails a link bound to userId and secret; unknown emails stay silent', async () => {
  const userRow = {
    id: 'user-5',
    email: 'five@test.dev',
    name: 'Five',
    password_hash: 'scrypt$hash',
    email_verification: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };

  const mailer = noopMailer();
  const queryer = fakeQueryer(({ call }) => (call === 0 ? [userRow] : [{ id: 'reset-1', expires_at: '2026-12-01T00:00:00.000Z' }]));
  const provider = createPostgresAuthProvider(queryer, {
    mailer,
    env: { NEXT_PUBLIC_APP_URL: 'https://pdf.example' },
  });

  await provider.requestRecovery({ email: 'five@test.dev', redirectUrl: 'https://pdf.example/reset-password' });

  assert.equal(mailer.sent.length, 1);
  assert.equal(mailer.sent[0].to, 'five@test.dev');
  const url = new URL(mailer.sent[0].resetUrl);
  assert.equal(url.origin + url.pathname, 'https://pdf.example/reset-password');
  assert.equal(url.searchParams.get('userId'), 'user-5');
  assert.ok((url.searchParams.get('secret') ?? '').length >= 40);

  const silent = noopMailer();
  const empty = fakeQueryer(() => []);
  await createPostgresAuthProvider(empty, {
    mailer: silent,
    env: {},
  }).requestRecovery({ email: 'ghost@test.dev', redirectUrl: 'https://pdf.example/reset-password' });
  assert.equal(silent.sent.length, 0, 'unknown emails must not enumerate users or send email');
  assert.equal(
    empty.calls.filter((call) => /insert into auth_password_reset_tokens/i.test(call.text)).length,
    0,
  );
});

test('password reset confirm consumes the token once and updates only the token owner', async () => {
  const { verifyPassword } = await import('../src/backend/auth/password.ts');
  const consumedUser = 'user-5';

  const happy = fakeQueryer(({ call }) => (call === 0 ? [{ user_id: consumedUser }] : [{ id: consumedUser }]));
  const provider = createPostgresAuthProvider(happy, { mailer: noopMailer() });

  await provider.confirmRecovery({ userId: consumedUser, secret: 'the-reset-secret', password: 'new-password-1' });

  const update = happy.calls[1];
  assert.match(update.text, /update auth_users/i);
  assert.equal(update.values[0], consumedUser, 'the password update is bound to the token owner');
  assert.ok(typeof update.values[1] === 'string' && update.values[1].startsWith('scrypt$'));
  assert.equal(
    update.values.filter((value) => value === 'new-password-1').length,
    0,
    'the new plaintext password never reaches the database',
  );
  assert.equal(await verifyPassword('new-password-1', update.values[1]), true);

  const expiredOrUsed = fakeQueryer(() => []);
  await assert.rejects(
    () =>
      createPostgresAuthProvider(expiredOrUsed, { mailer: noopMailer() }).confirmRecovery({
        userId: consumedUser,
        secret: 'the-reset-secret',
        password: 'new-password-1',
      }),
    { message: 'Invalid or expired reset token' },
  );
  assert.equal(
    expiredOrUsed.calls.filter((call) => /update auth_users/i.test(call.text)).length,
    0,
    'a failed token consumption must not change any password',
  );
});

test('confirm refuses a userId that does not match the token owner', async () => {
  const queryer = fakeQueryer(() => [{ user_id: 'user-5' }]);
  const provider = createPostgresAuthProvider(queryer, { mailer: noopMailer() });

  await assert.rejects(
    () =>
      provider.confirmRecovery({ userId: 'user-6', secret: 'the-reset-secret', password: 'new-password-1' }),
    { message: 'Invalid or expired reset token' },
  );
  assert.equal(
    queryer.calls.filter((call) => /update auth_users/i.test(call.text)).length,
    0,
  );
});

test('oauth token verification resolves the owning principal', async () => {
  const queryer = fakeQueryer(({ call }) =>
    call === 0
      ? [
          {
            id: 'tok-1',
            client_id: 'client-1',
            user_id: 'user-2',
            scopes: ['documents:read'],
            expires_at: '2026-12-01T00:00:00.000Z',
            created_at: '2026-01-01T00:00:00.000Z',
          },
        ]
      : [{ id: 'user-2', email: 'two@test.dev', name: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' }],
  );
  const provider = createPostgresAuthProvider(queryer, { mailer: noopMailer() });

  const principal = await provider.verifyOAuthAccessToken('presented-access-token');

  assert.deepEqual(principal, { id: 'user-2', email: 'two@test.dev', isApiKey: false });
});
