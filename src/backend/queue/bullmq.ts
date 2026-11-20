import { Queue } from "bullmq";
import type { DataJobQueue, GenerationJobPayload, WebhookDeliveryJobPayload } from "../data-contracts";

/**
 * ioredis connection options parsed from REDIS_URL. BullMQ loads ioredis, which
 * is now a declared runtime dependency: without it BullMQ cannot build a client
 * in a native ESM process and every enqueue throws. Constructing queues or
 * workers without enqueuing still never touches the network.
 */
export interface RedisConnectionOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  maxRetriesPerRequest: null;
}

export function parseRedisUrl(url: string): RedisConnectionOptions {
  const parsed = new URL(url);
  const options: RedisConnectionOptions = {
    host: parsed.hostname || "127.0.0.1",
    port: parsed.port ? Number.parseInt(parsed.port, 10) : 6379,
    maxRetriesPerRequest: null,
  };
  if (parsed.username && parsed.username !== "default") {
    options.username = parsed.username;
  }
  if (parsed.password) {
    options.password = parsed.password;
  }
  const db = parsed.pathname?.replace(/^\//, "");
  if (db && /^\d+$/.test(db)) {
    options.db = Number.parseInt(db, 10);
  }
  return options;
}

export const GENERATION_QUEUE_NAME = process.env.PDF_QUEUE_NAME || "pdf-generation";
export const WEBHOOK_QUEUE_NAME = process.env.WEBHOOK_QUEUE_NAME || "webhook-delivery";

export type QueueEnvironment = Record<string, string | undefined>;

export interface QueueDefaults {
  attempts: number;
  backoff: { type: "exponential"; delay: number };
  removeOnComplete: { age: number; count: number };
  removeOnFail: { age: number };
}

/** Bounded, deterministic defaults shared by both queues. */
export function queueDefaults(env: QueueEnvironment = process.env): QueueDefaults {
  const parsedAttempts = Number.parseInt(env.PDF_QUEUE_JOB_ATTEMPTS ?? "", 10);
  const attempts = Number.isFinite(parsedAttempts) && parsedAttempts > 0 ? parsedAttempts : 3;
  return {
    attempts,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 86400 },
  };
}

/**
 * Validates REDIS_URL and returns the BullMQ connection options. BullMQ
 * establishes the actual connection lazily, so creating queues or workers
 * without enqueuing or consuming never touches the network.
 */
export function redisConnectionOptions(env: QueueEnvironment = process.env): RedisConnectionOptions {
  const connection = env.REDIS_URL;
  if (!connection) {
    throw new Error("REDIS_URL is required for the postgres backend job queue");
  }

  // BullMQ requires maxRetriesPerRequest: null.
  return parseRedisUrl(connection);
}

/**
 * Creates the BullMQ-backed data job queue. Queue construction does not open a
 * Redis connection; the first enqueue does, so importing this module is safe
 * for Appwrite deployments as long as it is only called for the postgres
 * provider.
 */
export function createDataJobQueue(env: QueueEnvironment = process.env): DataJobQueue {
  const connection = redisConnectionOptions(env);

  const defaults = queueDefaults(env);

  const generation = new Queue<GenerationJobPayload>(GENERATION_QUEUE_NAME, {
    connection,
    defaultJobOptions: defaults,
  });
  const webhook = new Queue<WebhookDeliveryJobPayload>(WEBHOOK_QUEUE_NAME, {
    connection,
    defaultJobOptions: defaults,
  });

  return {
    async enqueueGeneration(input) {
      const job = await generation.add("generate", input);
      return { id: String(job.id) };
    },

    async enqueueWebhookDelivery(input) {
      const job = await webhook.add("deliver", input);
      return { id: String(job.id) };
    },

    async close() {
      await generation.close();
      await webhook.close();
    },
  };
}
