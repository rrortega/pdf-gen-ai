import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLoggingMailer, resolveMailer } from '../src/backend/auth/mailer.ts';

function captureLog() {
  const lines = [];
  const original = console.log;
  console.log = (...args) => lines.push(args.join(' '));
  return {
    lines,
    restore() {
      console.log = original;
    },
  };
}

test('without SMTP configuration the mailer is a no-op logging adapter', async () => {
  const mailer = resolveMailer({});
  assert.equal(mailer.kind, 'logging');
});

test('the logging adapter never logs the reset URL or its secret', async () => {
  const captured = captureLog();
  try {
    const secret = 'top-secret-reset-token-value';
    const resetUrl = `https://pdf.example/reset-password?userId=user-1&secret=${secret}`;

    await createLoggingMailer().sendPasswordResetEmail('owner@test.dev', resetUrl);

    const output = captured.lines.join('\n');
    assert.match(output, /owner@test\.dev/, 'the recipient is logged for operators');
    assert.ok(!output.includes(secret), 'the reset secret must never be logged');
    assert.ok(!output.includes(resetUrl), 'the reset URL must never be logged');
  } finally {
    captured.restore();
  }
});

test('with SMTP_HOST configured the adapter switches to SMTP without touching the network eagerly', () => {
  const mailer = resolveMailer({ SMTP_HOST: 'smtp.internal.test' });
  assert.equal(mailer.kind, 'smtp');
});

test('the adapter interface is the same for both kinds', async () => {
  const logging = resolveMailer({});
  const smtp = resolveMailer({ SMTP_HOST: 'smtp.internal.test' });
  assert.equal(typeof logging.sendPasswordResetEmail, 'function');
  assert.equal(typeof smtp.sendPasswordResetEmail, 'function');
});
