/**
 * Bounded webhook retry policy for the delivery worker.
 *
 * The legacy inline sender used 3 attempts with a fixed 10s wait; the worker
 * keeps the same default bound but grows the wait exponentially, capped so a
 * dead webhook never stalls the worker for minutes on end.
 */

export interface WebhookRetryDecision {
  /** Attempts already made (1-based, i.e. after the first delivery attempt). */
  attempt: number;
  retry: boolean;
  /** Milliseconds to wait before the next attempt; 0 when not retrying. */
  delayMs: number;
}

export const WEBHOOK_MAX_DELAY_MS = 60000;

export function nextWebhookAttempt(
  attempt: number,
  maxAttempts: number,
  baseDelayMs: number,
  maxDelayMs: number = WEBHOOK_MAX_DELAY_MS,
): WebhookRetryDecision {
  const retry = attempt < maxAttempts;
  if (!retry) {
    return { attempt, retry: false, delayMs: 0 };
  }
  const exponential = baseDelayMs * Math.pow(2, attempt - 1);
  return { attempt, retry: true, delayMs: Math.min(exponential, maxDelayMs) };
}

export interface WebhookRetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
}

export type RetryEnvironment = Record<string, string | undefined>;

/** Reads the retry bounds from the environment, falling back to bounded defaults. */
export function readWebhookRetryConfig(env: RetryEnvironment = process.env): WebhookRetryConfig {
  const parsedAttempts = Number.parseInt(env.PDF_WEBHOOK_MAX_ATTEMPTS ?? "", 10);
  const parsedBase = Number.parseInt(env.PDF_WEBHOOK_BACKOFF_BASE_MS ?? "", 10);

  return {
    maxAttempts:
      Number.isFinite(parsedAttempts) && parsedAttempts > 0 ? parsedAttempts : 3,
    baseDelayMs:
      Number.isFinite(parsedBase) && parsedBase > 0 ? parsedBase : 10000,
  };
}
