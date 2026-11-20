import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  processGenerationJob,
  processWebhookDeliveryJob,
  gracefulShutdown,
  buildWebhookSuccessPayload,
  buildWebhookFailurePayload,
} from '../src/worker/pdf-worker.ts';

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64');

function makeServices(overrides = {}) {
  const store = {
    documents: new Map(),
    updates: [],
    webhookDeliveries: [],
    webhookUpdates: [],
    async getDocumentById(id) {
      return this.documents.get(id) ?? null;
    },
    async getTemplateById(id) {
      return {
        $id: id,
        html: '<h1>{{title}}</h1>',
        css: 'body{}',
        orientation: 'portrait',
        paper_size: 'A4',
        margin_top: '10mm',
        margin_right: '10mm',
        margin_bottom: '10mm',
        margin_left: '10mm',
      };
    },
    async updateDocumentById(id, patch) {
      this.updates.push({ id, patch });
      const current = this.documents.get(id);
      this.documents.set(id, { ...current, ...patch });
    },
    async createWebhookDelivery(input) {
      const row = { $id: `wh-${this.webhookDeliveries.length + 1}`, retry: 0, response: null, payload: null, execution_time: 0, ...input };
      this.webhookDeliveries.push(row);
      return row;
    },
    async updateWebhookDelivery(id, patch) {
      this.webhookUpdates.push({ id, patch });
    },
  };

  const rendered = [];
  const closed = [];
  const uploaded = [];
  const enqueued = [];
  const sleeps = [];

  const services = {
    store,
    async renderPdf(input) {
      rendered.push(input);
      return { buffer: Buffer.alloc(20480) };
    },
    onClosePage: (fn) => closed.push(fn),
    async storagePutPdf(input) {
      uploaded.push(input);
      return { key: input.key };
    },
    async signDownloadJwt(payload) {
      return `sig-for-${payload.download_id}`;
    },
    async enqueueWebhookDelivery(payload) {
      enqueued.push(payload);
      return { id: `job-${enqueued.length}` };
    },
    async deliverWebhook() {
      return { ok: true, status: 200, response: '200 OK' };
    },
    baseUrl: () => 'https://pdf.example.com',
    sleep: async (ms) => sleeps.push(ms),
    ...overrides,
  };

  return { services, store, rendered, closed, uploaded, enqueued, sleeps };
}

function makeDocument(overrides = {}) {
  return {
    $id: 'doc-1',
    user_id: 'user-1',
    template_id: 'tpl-1',
    name: 'Contract',
    pdf_file: null,
    data: b64({ title: 'Hello' }),
    status: 'queued',
    size: 0,
    downloads: 0,
    signature: null,
    error_message: null,
    webhook_callback: null,
    webhook_response: null,
    webhook_retry: 0,
    $createdAt: '2026-01-01T00:00:00.000Z',
    $updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('generation job renders once, uploads the pdf and completes the document', async () => {
  const { services, store, rendered, uploaded, enqueued } = makeServices();
  store.documents.set('doc-1', makeDocument({ webhook_callback: 'https://hooks.example.com/done' }));

  const result = await processGenerationJob('doc-1', services);

  assert.equal(result, 'completed');
  assert.equal(rendered.length, 1);
  assert.equal(rendered[0].data.title, 'Hello');
  assert.equal(rendered[0].options.paperSize, 'A4');
  assert.equal(uploaded[0].key, 'doc-1.pdf');
  assert.equal(uploaded[0].contentType, 'application/pdf');

  const patch = store.updates.at(-1).patch;
  assert.equal(patch.status, 'completed');
  assert.equal(patch.pdf_file, 'doc-1.pdf');
  assert.equal(patch.size, 20);
  assert.equal(patch.signature, 'sig-for-doc-1');

  assert.equal(enqueued.length, 1);
  assert.equal(enqueued[0].url, 'https://hooks.example.com/done');
  assert.equal(enqueued[0].payload.download_id, 'doc-1');
  assert.equal(enqueued[0].payload.status, 'completed');
  assert.equal(
    enqueued[0].payload.download_url,
    'https://pdf.example.com/api/v1/documents/doc-1/download?signature=sig-for-doc-1',
  );
});

test('generation job without a webhook callback does not enqueue anything', async () => {
  const { services, enqueued } = makeServices();
  (services.store).documents.set('doc-1', makeDocument());

  await processGenerationJob('doc-1', services);
  assert.equal(enqueued.length, 0);
});

test('failed rendering marks the document failed with the error message and notifies the webhook', async () => {
  const { services, store, enqueued } = makeServices({
    async renderPdf() {
      throw new Error('puppeteer crashed');
    },
  });
  store.documents.set('doc-1', makeDocument({ webhook_callback: 'https://hooks.example.com/done' }));

  const result = await processGenerationJob('doc-1', services);

  assert.equal(result, 'failed');
  const patch = store.updates.at(-1).patch;
  assert.equal(patch.status, 'failed');
  assert.equal(patch.error_message, 'puppeteer crashed');
  assert.equal(enqueued[0].payload.success, false);
  assert.equal(enqueued[0].payload.status, 'failed');
  assert.equal(enqueued[0].payload.error, 'puppeteer crashed');
  assert.equal(enqueued[0].payload.download_id, 'doc-1');
});

test('generation job for an unknown document fails instead of guessing', async () => {
  const { services } = makeServices();
  await assert.rejects(
    () => processGenerationJob('missing-doc', services),
    /Document not found/,
  );
});

test('webhook delivery retries with exponential backoff until it succeeds', async () => {
  let attempts = 0;
  const { services, store, sleeps } = makeServices({
    async deliverWebhook() {
      attempts += 1;
      if (attempts === 1) {
        return { ok: false, status: 500, response: '500 Internal Server Error: down' };
      }
      return { ok: true, status: 200, response: '200 OK' };
    },
  });
  store.documents.set('doc-1', makeDocument({ webhook_callback: 'https://hooks.example.com/done' }));
  const delivery = await services.store.createWebhookDelivery({
    document_id: 'doc-1',
    url: 'https://hooks.example.com/done',
    payload: JSON.stringify({ download_id: 'doc-1' }),
  });

  const result = await processWebhookDeliveryJob(delivery, services, { maxAttempts: 3, baseDelayMs: 10000 });

  assert.equal(result, 'delivered');
  assert.equal(attempts, 2);
  assert.deepEqual(sleeps, [10000]);

  const update = store.webhookUpdates.at(-1).patch;
  assert.equal(update.retry, 2);
  assert.equal(update.response, '200 OK');

  const docPatch = store.updates.at(-1).patch;
  assert.equal(docPatch.webhook_retry, 2);
  assert.equal(docPatch.webhook_response, '200 OK');
});

test('webhook delivery exhausts its bounded attempts and records the last response', async () => {
  const { services, store, sleeps } = makeServices({
    async deliverWebhook() {
      return { ok: false, status: 503, response: '503 Service Unavailable: still down' };
    },
  });
  const delivery = await services.store.createWebhookDelivery({
    document_id: 'doc-1',
    url: 'https://hooks.example.com/done',
    payload: '{}',
  });

  const result = processWebhookDeliveryJob(delivery, services, { maxAttempts: 3, baseDelayMs: 10000 });

  assert.equal(await result, 'exhausted');
  assert.equal(sleeps.length, 2);
  const update = store.webhookUpdates.at(-1).patch;
  assert.equal(update.retry, 3);
  assert.equal(update.response, '503 Service Unavailable: still down');
});

test('webhook payload builders keep the legacy field names', () => {
  const doc = makeDocument({ signature: 'sig-1' });
  const success = buildWebhookSuccessPayload(doc, 42, 'https://pdf.example.com');
  assert.deepEqual(success, {
    success: true,
    download_id: 'doc-1',
    status: 'completed',
    download_url: 'https://pdf.example.com/api/v1/documents/doc-1/download?signature=sig-1',
    name: 'Contract',
    size: 42,
  });

  const failure = buildWebhookFailurePayload(doc, 'boom');
  assert.deepEqual(failure, {
    success: false,
    download_id: 'doc-1',
    status: 'failed',
    error: 'boom',
  });
});

test('graceful shutdown closes every handle in order and survives a failing closer', async () => {
  const order = [];
  const summary = await gracefulShutdown([
    { name: 'worker', close: async () => { order.push('worker'); } },
    { name: 'browser', close: async () => { order.push('browser'); throw new Error('browser already dead'); } },
    { name: 'queue', close: async () => { order.push('queue'); } },
  ]);

  assert.deepEqual(order, ['worker', 'browser', 'queue']);
  assert.deepEqual(summary.closed, ['worker', 'queue']);
  assert.deepEqual(summary.failed, ['browser']);
});
