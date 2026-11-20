import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SignJWT } from "jose";
import { Worker as BullWorker } from "bullmq";
import { PDFGenerator } from "../lib/pdf-generator";
import { isPostgresBackend } from "../backend/config";
import { closePool } from "../backend/db";
import { createMinioObjectStore } from "../backend/storage/minio";
import {
  createDataJobQueue,
  redisConnectionOptions,
  queueDefaults,
} from "../backend/queue/bullmq";
import {
  nextWebhookAttempt,
  readWebhookRetryConfig,
} from "../backend/queue/retry";
import { createPostgresDocumentRepository } from "../backend/postgres/documents";
import { createPostgresTemplateRepository } from "../backend/postgres/templates";
import { createPostgresWebhookDeliveryRepository } from "../backend/postgres/webhooks";
import { runPostgresDataMigrationsWithPool } from "../backend/postgres/migrate";
import type {
  DocumentRow,
  DocumentUpdatePatch,
  GenerationJobPayload,
  ObjectStore,
  PutPdfInput,
  TemplateRow,
  WebhookDeliveryJobPayload,
  WebhookDeliveryRow,
} from "../backend/data-contracts";

/**
 * Long-running PDF generation and webhook delivery worker for the postgres
 * backend. One browser per worker (the shared PDFGenerator), one page per job,
 * bounded concurrency and periodic browser recycle keep RAM predictable.
 */

export interface WorkerStore {
  getDocumentById(id: string): Promise<DocumentRow | null>;
  getTemplateById(id: string): Promise<TemplateRow | null>;
  updateDocumentById(id: string, patch: DocumentUpdatePatch): Promise<void>;
  createWebhookDelivery(input: {
    document_id: string;
    url: string;
    retry?: number;
    payload?: string | null;
  }): Promise<WebhookDeliveryRow>;
  updateWebhookDelivery(
    id: string,
    patch: { retry?: number; response?: string | null; payload?: string | null; execution_time?: number },
  ): Promise<void>;
}

export interface RenderInput {
  html: string;
  css: string;
  data: Record<string, unknown>;
  options?: {
    orientation?: "portrait" | "landscape";
    paperSize?: string;
    margins?: { top: string; right: string; bottom: string; left: string };
  };
}

export interface DeliveryResult {
  ok: boolean;
  status?: number;
  response: string;
}

export interface WorkerServices {
  store: WorkerStore;
  renderPdf(input: RenderInput): Promise<{ buffer: Buffer }>;
  storagePutPdf(input: PutPdfInput): Promise<{ key: string }>;
  signDownloadJwt(payload: { userId: string; download_id: string }): Promise<string>;
  enqueueWebhookDelivery(input: WebhookDeliveryJobPayload): Promise<{ id: string }>;
  deliverWebhook(url: string, payload: Record<string, unknown>): Promise<DeliveryResult>;
  baseUrl(): string;
  sleep(ms: number): Promise<void>;
}

export type GenerationOutcome = "completed" | "failed";
export type WebhookOutcome = "delivered" | "exhausted";

export function buildWebhookSuccessPayload(
  doc: DocumentRow,
  size: number,
  baseUrl: string,
): Record<string, unknown> {
  return {
    success: true,
    download_id: doc.$id,
    status: "completed",
    download_url: `${baseUrl}/api/v1/documents/${doc.$id}/download?signature=${doc.signature ?? ""}`,
    name: doc.name,
    size,
  };
}

export function buildWebhookFailurePayload(
  doc: DocumentRow,
  errorMessage: string,
): Record<string, unknown> {
  return {
    success: false,
    download_id: doc.$id,
    status: "failed",
    error: errorMessage,
  };
}

/**
 * Processes one queued generation job: render with the shared PDFGenerator,
 * upload to MinIO, mark the document completed and register/enqueue the
 * webhook delivery when a callback is configured.
 */
export async function processGenerationJob(
  documentId: string,
  services: WorkerServices,
): Promise<GenerationOutcome> {
  const doc = await services.store.getDocumentById(documentId);
  if (!doc) {
    throw new Error(`Document not found: ${documentId}`);
  }

  try {
    const template = await services.store.getTemplateById(doc.template_id);
    if (!template) {
      throw new Error(`Template not found: ${doc.template_id}`);
    }

    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(Buffer.from(doc.data || "", "base64").toString("utf8")) ?? {};
    } catch {
      data = {};
    }

    const { buffer } = await services.renderPdf({
      html: template.html,
      css: template.css,
      data,
      options: {
        orientation: template.orientation === "landscape" ? "landscape" : "portrait",
        paperSize: template.paper_size || "A4",
        margins: {
          top: template.margin_top || "10mm",
          right: template.margin_right || "10mm",
          bottom: template.margin_bottom || "10mm",
          left: template.margin_left || "10mm",
        },
      },
    });

    const key = `${doc.$id}.pdf`;
    await services.storagePutPdf({ key, body: new Uint8Array(buffer), contentType: "application/pdf" });

    const signature = await services.signDownloadJwt({
      userId: doc.user_id,
      download_id: doc.$id,
    });
    const size = Math.round(buffer.length / 1024);

    await services.store.updateDocumentById(doc.$id, {
      pdf_file: key,
      status: "completed",
      size,
      signature,
    });

    if (doc.webhook_callback) {
      const payload = buildWebhookSuccessPayload(
        { ...doc, signature },
        size,
        services.baseUrl(),
      );
      const delivery = await services.store.createWebhookDelivery({
        document_id: doc.$id,
        url: doc.webhook_callback,
        payload: JSON.stringify(payload),
      });
      await services.enqueueWebhookDelivery({
        documentId: doc.$id,
        deliveryId: delivery.$id,
        url: doc.webhook_callback,
        payload,
      });
    }

    return "completed";
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await services.store.updateDocumentById(doc.$id, {
      status: "failed",
      error_message: errorMessage,
    });

    if (doc.webhook_callback) {
      const payload = buildWebhookFailurePayload(doc, errorMessage);
      const delivery = await services.store.createWebhookDelivery({
        document_id: doc.$id,
        url: doc.webhook_callback,
        payload: JSON.stringify(payload),
      });
      await services.enqueueWebhookDelivery({
        documentId: doc.$id,
        deliveryId: delivery.$id,
        url: doc.webhook_callback,
        payload,
      });
    }

    return "failed";
  }
}

/**
 * Delivers a webhook with bounded retries and exponential backoff, recording
 * every outcome on the webhook_deliveries row and the owning document.
 */
export async function processWebhookDeliveryJob(
  delivery: Pick<WebhookDeliveryRow, "$id" | "url" | "payload">,
  services: WorkerServices,
  retryConfig = readWebhookRetryConfig(),
): Promise<WebhookOutcome> {
  const startedAt = Date.now();
  let lastResponse = "";
  let attempts = 0;

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(delivery.payload || "{}");
  } catch {
    payload = {};
  }

  const docId = typeof payload.download_id === "string" ? payload.download_id : null;

  for (;;) {
    attempts += 1;
    try {
      const result = await services.deliverWebhook(delivery.url, payload);
      lastResponse = result.response;
      if (result.ok) {
        break;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      lastResponse = `Error: ${message}`;
    }

    const decision = nextWebhookAttempt(attempts, retryConfig.maxAttempts, retryConfig.baseDelayMs);
    if (!decision.retry) {
      await recordOutcome(docId, attempts, lastResponse);
      return "exhausted";
    }
    await services.sleep(decision.delayMs);
  }

  await recordOutcome(docId, attempts, lastResponse);
  return "delivered";

  async function recordOutcome(
    id: string | null,
    retryCount: number,
    response: string,
  ): Promise<void> {
    await services.store.updateWebhookDelivery(delivery.$id, {
      retry: retryCount,
      response,
      payload: JSON.stringify(payload),
      execution_time: Date.now() - startedAt,
    });
    if (id) {
      await services.store.updateDocumentById(id, {
        webhook_response: response,
        webhook_retry: retryCount,
      });
    }
  }
}

/**
 * Closes every long-lived handle in order. A closer that throws is recorded
 * instead of aborting the remaining closers, so shutdown always completes.
 */
export async function gracefulShutdown(
  closers: { name: string; close: () => Promise<void> }[],
): Promise<{ closed: string[]; failed: string[] }> {
  const closed: string[] = [];
  const failed: string[] = [];

  for (const closer of closers) {
    try {
      await closer.close();
      closed.push(closer.name);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[worker] failed to close ${closer.name}: ${message}`);
      failed.push(closer.name);
    }
  }

  return { closed, failed };
}

/** Real service wiring for the production worker process. */
function createProductionServices(storage: ObjectStore): WorkerServices {
  const encoder = new TextEncoder();
  const jwtSecret = process.env.JWT_SECRET || "default-secret-change-me";

  return {
    store: {
      getDocumentById: (id) => createPostgresDocumentRepository().getById(id),
      getTemplateById: (id) => createPostgresTemplateRepository().getById(id),
      updateDocumentById: async (id, patch) => {
        await createPostgresDocumentRepository().updateById(id, patch);
      },
      createWebhookDelivery: (input) =>
        createPostgresWebhookDeliveryRepository().create(input),
      updateWebhookDelivery: async (id, patch) => {
        await createPostgresWebhookDeliveryRepository().update(id, patch);
      },
    },

    async renderPdf(input) {
      const buffer = await PDFGenerator.generatePDF(
        input.html,
        input.css,
        input.data,
        input.options,
      );
      return { buffer };
    },

    storagePutPdf: (input) => storage.putPdf(input),

    async signDownloadJwt(payload) {
      const secret = encoder.encode(jwtSecret);
      return new SignJWT({ userId: payload.userId, download_id: payload.download_id })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .sign(secret);
    },

    enqueueWebhookDelivery: async (input) => {
      const queue = createDataJobQueue();
      try {
        return await queue.enqueueWebhookDelivery(input);
      } finally {
        await queue.close();
      }
    },

    async deliverWebhook(url, payload) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const text = await response.text();
        return {
          ok: response.ok,
          status: response.status,
          response: `${response.status} ${response.statusText}: ${text.substring(0, 500)}`,
        };
      } finally {
        clearTimeout(timeoutId);
      }
    },

    baseUrl: () =>
      process.env.NEXT_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_APP_URL || "",

    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

/**
 * Starts the long-running worker. Requires BACKEND_PROVIDER=postgres plus the
 * postgres/redis/minio environment documented in docs/backend-data.md.
 */
export async function startPdfWorker(): Promise<void> {
  if (!isPostgresBackend()) {
    throw new Error("startPdfWorker requires BACKEND_PROVIDER=postgres");
  }

  await runPostgresDataMigrationsWithPool();

  const services = createProductionServices(createMinioObjectStore());
  const queue = createDataJobQueue();
  const connection = redisConnectionOptions();
  const defaults = queueDefaults();
  const concurrency = Number.parseInt(process.env.PDF_WORKER_CONCURRENCY ?? "", 10);
  const recycleEvery = Number.parseInt(process.env.PDF_BROWSER_RECYCLE_JOBS ?? "", 10);
  const jobsBeforeRecycle = Number.isFinite(recycleEvery) && recycleEvery > 0 ? recycleEvery : 100;

  let generationJobsDone = 0;

  const generationWorker = new BullWorker<GenerationJobPayload>(
    "pdf-generation",
    async (job) => {
      const outcome = await processGenerationJob(job.data.documentId, services);
      if (outcome === "completed") {
        generationJobsDone += 1;
        if (generationJobsDone % jobsBeforeRecycle === 0) {
          // Periodic browser recycle keeps RAM bounded (one browser per worker).
          await PDFGenerator.cleanup();
        }
      }
      return outcome;
    },
    {
      connection,
      concurrency: Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 2,
    },
  );

  const webhookWorker = new BullWorker<WebhookDeliveryJobPayload>(
    "webhook-delivery",
    async (job) => {
      return processWebhookDeliveryJob(
        { $id: job.data.deliveryId, url: job.data.url, payload: JSON.stringify(job.data.payload) },
        services,
      );
    },
    { connection },
  );

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal} received, shutting down...`);
    await gracefulShutdown([
      { name: "generation-worker", close: () => generationWorker.close() },
      { name: "webhook-worker", close: () => webhookWorker.close() },
      { name: "queue", close: () => queue.close() },
      { name: "browser", close: () => PDFGenerator.cleanup() },
      { name: "postgres-pool", close: () => closePool() },
    ]);
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  console.log(
    `[worker] pdf worker started (queue=${path.basename("pdf-generation")}, concurrency=${generationWorker.opts.concurrency ?? 2}, attempts=${defaults.attempts})`,
  );
}

// Long-running entry point: node --import tsx src/worker/pdf-worker.ts
// Compare real paths: a symlinked checkout or mount must still start the worker.
// A raw path comparison silently turns the long-running worker into a no-op.
function isEntryPoint(): boolean {
  const invoked = process.argv[1];
  if (!invoked) {
    return false;
  }

  try {
    return realpathSync(path.resolve(invoked)) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  startPdfWorker().catch((error) => {
    console.error("[worker] fatal:", error);
    process.exit(1);
  });
}
