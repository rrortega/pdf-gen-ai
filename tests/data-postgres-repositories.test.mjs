import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createPostgresTemplateRepository,
} from '../src/backend/postgres/templates.ts';
import {
  createPostgresDocumentRepository,
} from '../src/backend/postgres/documents.ts';
import {
  createPostgresWebhookDeliveryRepository,
} from '../src/backend/postgres/webhooks.ts';
import {
  toTemplateListItem,
  toTemplateDetail,
  toTemplateUpdateResponse,
  toDocumentListRow,
} from '../src/backend/data/presenter.ts';

test('document stats scan includes trashed rows for the owner only', async () => {
  const queryer = fakeQueryer(() => []);
  const repo = createPostgresDocumentRepository(queryer);

  const rows = await repo.listForStats('user-1', 500);

  assert.deepEqual(rows, []);
  const text = queryer.calls[0].text;
  assert.match(text, /user_id = \$1/);
  assert.doesNotMatch(text, /status <> 'trashed'/);
});

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64');

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

test('template create is owner scoped and returns an Appwrite-shaped row', async () => {
  const queryer = fakeQueryer(() => [
    {
      id: '11111111-1111-1111-1111-111111111111',
      user_id: 'user-1',
      title: 'Invoice',
      description: null,
      tags: ['billing'],
      html: '<h1>{{title}}</h1>',
      css: 'body{}',
      test_data: b64({ title: 'Sample' }),
      orientation: 'portrait',
      paper_size: 'A4',
      margin_top: '20mm',
      margin_right: '20mm',
      margin_bottom: '20mm',
      margin_left: '20mm',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
  ]);
  const repo = createPostgresTemplateRepository(queryer);

  const row = await repo.create('user-1', {
    title: 'Invoice',
    tags: ['billing'],
    html: '<h1>{{title}}</h1>',
    css: 'body{}',
    test_data: b64({ title: 'Sample' }),
    orientation: 'portrait',
    paper_size: 'A4',
    margin_top: '20mm',
    margin_right: '20mm',
    margin_bottom: '20mm',
    margin_left: '20mm',
  });

  assert.equal(row.$id, '11111111-1111-1111-1111-111111111111');
  assert.equal(row.$createdAt, '2026-01-01T00:00:00.000Z');
  assert.equal(row.user_id, 'user-1');
  const insert = queryer.calls[0];
  assert.match(insert.text, /insert into templates/i);
  assert.ok(insert.values.includes('user-1'));
});

test('template get never returns another owner row', async () => {
  const queryer = fakeQueryer(() => []);
  const repo = createPostgresTemplateRepository(queryer);

  const row = await repo.get('user-2', '11111111-1111-1111-1111-111111111111');

  assert.equal(row, null);
  const select = queryer.calls[0];
  assert.match(select.text, /user_id = \$2/);
  assert.equal(select.values[0], '11111111-1111-1111-1111-111111111111');
  assert.equal(select.values[1], 'user-2');
});

test('template list filters by owner unless the base flag is set', async () => {
  const queryer = fakeQueryer(() => []);
  const repo = createPostgresTemplateRepository(queryer);

  await repo.list({ ownerId: 'user-1' });
  assert.match(queryer.calls[0].text, /user_id = \$1/);

  await repo.list({ ownerId: 'user-1', base: true });
  assert.match(queryer.calls[1].text, /user_id is null/i);
});

test('template list applies search, tags and ids filters', async () => {
  const queryer = fakeQueryer(() => []);
  const repo = createPostgresTemplateRepository(queryer);

  await repo.list({
    ownerId: 'user-1',
    search: 'invoice',
    tags: ['billing'],
    ids: ['a', 'b'],
  });

  const text = queryer.calls[0].text;
  assert.match(text, /ilike/i);
  assert.match(text, /&& /i);
  assert.match(text, /id = any/i);
  assert.deepEqual(queryer.calls[0].values.slice(0, 4), ['user-1', '%invoice%', ['billing'], ['a', 'b']]);
});

test('document list excludes trashed, orders newest first and paginates', async () => {
  const queryer = fakeQueryer(() => []);
  const repo = createPostgresDocumentRepository(queryer);

  await repo.list('user-1', { page: 2, limit: 10 });

  const text = queryer.calls[0].text;
  assert.match(text, /user_id = \$1/);
  assert.match(text, /status <> 'trashed'/);
  assert.match(text, /order by created_at desc/i);
  assert.deepEqual(queryer.calls[0].values.slice(-2), [10, 10]);
});

test('document trash is owner scoped and clears the pdf file', async () => {
  const queryer = fakeQueryer(() => []);
  const repo = createPostgresDocumentRepository(queryer);

  await repo.trash('user-1', 'doc-1');

  const update = queryer.calls[0];
  assert.match(update.text, /status = 'trashed'/);
  assert.match(update.text, /pdf_file = null/i);
  assert.match(update.text, /user_id = \$2/);
  assert.equal(update.values[0], 'doc-1');
  assert.equal(update.values[1], 'user-1');
});

test('document download counter increments atomically', async () => {
  const queryer = fakeQueryer(() => []);
  const repo = createPostgresDocumentRepository(queryer);

  await repo.incrementDownloads('user-1', 'doc-1');

  const update = queryer.calls[0];
  assert.match(update.text, /downloads = downloads \+ 1/);
  assert.match(update.text, /user_id = \$2/);
});

test('worker-internal document and template loads are system scoped and update by id', async () => {
  const queryer = fakeQueryer(() => []);
  const docs = createPostgresDocumentRepository(queryer);
  const templates = createPostgresTemplateRepository(queryer);

  await docs.getById('doc-1');
  assert.doesNotMatch(queryer.calls[0].text, /user_id = \$/);
  assert.doesNotMatch(queryer.calls[0].text, /user_id is null/i);

  await templates.getById('tpl-1');
  assert.doesNotMatch(queryer.calls[1].text, /user_id = \$/);

  await docs.updateById('doc-1', { status: 'completed' });
  assert.doesNotMatch(queryer.calls[2].text, /user_id = \$/);
  assert.match(queryer.calls[2].text, /status = /);
});

test('document update maps status transitions and signature fields', async () => {
  const queryer = fakeQueryer(() => []);
  const repo = createPostgresDocumentRepository(queryer);

  await repo.update('user-1', 'doc-1', {
    status: 'completed',
    pdf_file: 'doc-1.pdf',
    size: 10,
    signature: 'jwt',
    error_message: null,
  });

  const update = queryer.calls[0];
  assert.match(update.text, /status = \$/);
  assert.match(update.text, /pdf_file = \$/);
  assert.match(update.text, /signature = \$/);
  assert.match(update.text, /user_id = \$7/);
  assert.equal(update.values.at(-1), 'user-1');
});

test('webhook delivery rows record retries and responses', async () => {
  const row = {
    id: 'wh-1',
    document_id: 'doc-1',
    url: 'https://example.com/hook',
    retry: 0,
    response: null,
    payload: null,
    execution_time: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
  const queryer = fakeQueryer(({ call }) => (call === 0 ? [row] : [{ ...row, retry: 3 }]));
  const repo = createPostgresWebhookDeliveryRepository(queryer);

  const created = await repo.create({
    document_id: 'doc-1',
    url: 'https://example.com/hook',
    retry: 0,
  });
  assert.match(queryer.calls[0].text, /insert into webhook_deliveries/i);
  assert.ok(queryer.calls[0].values.includes('doc-1'));
  assert.equal(created.$id, 'wh-1');

  const updated = await repo.update('wh-1', { retry: 3, response: '200 OK', payload: '{}' });
  const update = queryer.calls[1];
  assert.match(update.text, /update webhook_deliveries/i);
  assert.match(update.text, /retry = \$/);
  assert.match(update.text, /response = \$/);
  assert.equal(updated.retry, 3);
});

test('presenter keeps response field names stable and never leaks internal columns', () => {
  const row = {
    $id: 'doc-1',
    $createdAt: '2026-01-01T00:00:00.000Z',
    $updatedAt: '2026-01-01T00:00:00.000Z',
    title: 'Invoice',
    description: 'desc',
    tags: ['a'],
    css: 'body{}',
    html: '<h1/>',
    test_data: b64({ title: 'Sample' }),
    orientation: 'portrait',
    paper_size: 'A4',
    margin_top: '10mm',
    margin_right: '10mm',
    margin_bottom: '10mm',
    margin_left: '10mm',
    signature: 'jwt',
  };

  const listItem = toTemplateListItem(row, true);
  assert.deepEqual(listItem, {
    $id: 'doc-1',
    title: 'Invoice',
    description: 'desc',
    tags: ['a'],
    $createdAt: '2026-01-01T00:00:00.000Z',
    $updatedAt: '2026-01-01T00:00:00.000Z',
    request_payload: { title: 'Sample' },
  });

  const detail = toTemplateDetail(row);
  assert.deepEqual(detail, {
    $id: 'doc-1',
    $createdAt: '2026-01-01T00:00:00.000Z',
    $updatedAt: '2026-01-01T00:00:00.000Z',
    title: 'Invoice',
    tags: ['a'],
    css: 'body{}',
    html: '<h1/>',
    test_data: { title: 'Sample' },
    orientation: 'portrait',
    paperSize: 'A4',
    margins: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
  });

  const updated = toTemplateUpdateResponse(row);
  assert.deepEqual(updated.paperSize, 'A4');
  assert.deepEqual(updated.margins, { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' });
  assert.equal(updated.test_data.title, 'Sample');
  assert.equal(updated.signature, undefined);
});

test('presenter keeps unparseable test_data as the raw value like the legacy route', () => {
  const row = {
    $id: 'doc-1',
    $createdAt: 'x',
    $updatedAt: 'x',
    title: 't',
    description: null,
    tags: [],
    css: '',
    html: '',
    test_data: 'not-base64-json',
    orientation: 'portrait',
    paper_size: 'A4',
    margin_top: '10mm',
    margin_right: '10mm',
    margin_bottom: '10mm',
    margin_left: '10mm',
  };

  assert.equal(toTemplateDetail(row).test_data, 'not-base64-json');
});

test('document list presenter decodes the base64 payload and keeps failures raw', () => {
  const decoded = toDocumentListRow({ $id: 'd1', data: b64({ a: 1 }) });
  assert.deepEqual(decoded.data, { a: 1 });

  const raw = toDocumentListRow({ $id: 'd2', data: 'zzz-not-json' });
  assert.equal(raw.data, 'zzz-not-json');

  const empty = toDocumentListRow({ $id: 'd3', data: null });
  assert.equal(empty.data, null);
});
