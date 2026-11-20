import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  nextWebhookAttempt,
  readWebhookRetryConfig,
} from '../src/backend/queue/retry.ts';

test('webhook retries stop at the configured maximum', () => {
  const last = nextWebhookAttempt(3, 3, 10000);
  assert.equal(last.retry, false);
  assert.equal(last.delayMs, 0);

  const stillTrying = nextWebhookAttempt(2, 3, 10000);
  assert.equal(stillTrying.retry, true);
});

test('webhook backoff grows exponentially from the base delay', () => {
  assert.equal(nextWebhookAttempt(1, 5, 10000).delayMs, 10000);
  assert.equal(nextWebhookAttempt(2, 5, 10000).delayMs, 20000);
  assert.equal(nextWebhookAttempt(3, 5, 10000).delayMs, 40000);
});

test('webhook backoff is capped so a webhook never waits minutes unbounded', () => {
  assert.equal(nextWebhookAttempt(8, 12, 10000).delayMs, 60000);
  assert.equal(nextWebhookAttempt(1, 3, 120000).delayMs, 60000);
});

test('retry configuration falls back to bounded defaults on invalid input', () => {
  assert.deepEqual(readWebhookRetryConfig({}), { maxAttempts: 3, baseDelayMs: 10000 });
  assert.deepEqual(
    readWebhookRetryConfig({ PDF_WEBHOOK_MAX_ATTEMPTS: '5', PDF_WEBHOOK_BACKOFF_BASE_MS: '250' }),
    { maxAttempts: 5, baseDelayMs: 250 },
  );
  assert.deepEqual(
    readWebhookRetryConfig({ PDF_WEBHOOK_MAX_ATTEMPTS: 'not-a-number', PDF_WEBHOOK_BACKOFF_BASE_MS: '-1' }),
    { maxAttempts: 3, baseDelayMs: 10000 },
  );
});
