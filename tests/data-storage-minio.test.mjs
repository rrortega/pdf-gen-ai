import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readMinioConfig,
  createMinioObjectStore,
} from '../src/backend/storage/minio.ts';

const baseEnv = {
  S3_ENDPOINT: 'http://minio.local:9000',
  S3_BUCKET: 'pdfs',
  S3_ACCESS_KEY: 'minio-admin',
  S3_SECRET_KEY: 'minio-secret',
};

test('missing storage configuration fails with the variable names, never values', () => {
  for (const missing of ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY']) {
    const env = { ...baseEnv };
    delete env[missing];
    assert.throws(() => readMinioConfig(env), (error) => {
      assert.match(error.message, new RegExp(missing));
      return true;
    });
  }
});

test('presigned download URLs are S3-shaped and expire after the configured window', async () => {
  const store = createMinioObjectStore(baseEnv);
  const url = await store.presignDownload({ key: 'doc-1.pdf' });

  assert.ok(url.startsWith('http://minio.local:9000/pdfs/doc-1.pdf'));
  assert.match(url, /X-Amz-Signature=/);
  assert.match(url, /X-Amz-Expires=900/);
});

test('presign honours a custom expiry from the environment', async () => {
  const store = createMinioObjectStore({ ...baseEnv, S3_PRESIGN_EXPIRES_SECONDS: '60' });
  const url = await store.presignDownload({ key: 'doc-1.pdf' });
  assert.match(url, /X-Amz-Expires=60/);
});

test('putPdf uploads the object with the pdf content type', async () => {
  const sent = [];
  const fakeClient = {
    async send(command) {
      sent.push(command);
      return {};
    },
  };
  const store = createMinioObjectStore(baseEnv, fakeClient);

  const result = await store.putPdf({
    key: 'doc-1.pdf',
    body: new Uint8Array([1, 2, 3]),
  });

  assert.deepEqual(result, { key: 'doc-1.pdf' });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].input.Bucket, 'pdfs');
  assert.equal(sent[0].input.Key, 'doc-1.pdf');
  assert.equal(sent[0].input.ContentType, 'application/pdf');
  assert.deepEqual(new Uint8Array(sent[0].input.Body), new Uint8Array([1, 2, 3]));
});

test('delete removes the object from the configured bucket', async () => {
  const sent = [];
  const store = createMinioObjectStore(baseEnv, {
    async send(command) {
      sent.push(command);
      return {};
    },
  });

  await store.delete('doc-1.pdf');

  assert.equal(sent.length, 1);
  assert.equal(sent[0].input.Bucket, 'pdfs');
  assert.equal(sent[0].input.Key, 'doc-1.pdf');
});
