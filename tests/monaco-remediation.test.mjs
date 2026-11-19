import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const EXPECTED_VERSION = '0.58.0-dev-20261111';

const rootPackage = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);

test('pins monaco-editor to the exact patched prerelease (no caret)', async () => {
  assert.equal(rootPackage.dependencies['monaco-editor'], EXPECTED_VERSION);
  assert.ok(
    rootPackage.dependencies['@monaco-editor/react'],
    '@monaco-editor/react must stay as the editor wrapper',
  );

  const lock = JSON.parse(
    await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'),
  );
  const entry = lock.packages?.['node_modules/monaco-editor'];
  assert.ok(entry, 'lockfile must resolve node_modules/monaco-editor');
  assert.equal(entry.version, EXPECTED_VERSION);
});

test('loader is configured with the same-origin versioned vs path, not the CDN default', async () => {
  const mod = await import('../src/lib/monaco-loader.ts');

  assert.equal(mod.MONACO_VERSION, EXPECTED_VERSION);
  assert.equal(mod.MONACO_VS_PATH, `/monaco/${EXPECTED_VERSION}/min/vs`);
  assert.ok(!/^https?:/i.test(mod.MONACO_VS_PATH), 'path must be same-origin');
  assert.ok(
    !mod.MONACO_VS_PATH.includes('cdn.jsdelivr.net'),
    'no third-party CDN in the configured path',
  );
});

test('asset plan rejects an installed version mismatch with the expected pin', async () => {
  const { resolveMonacoAssetPlan } = await import(
    '../scripts/copy-monaco-assets.mjs'
  );

  assert.throws(
    () => resolveMonacoAssetPlan({ installedVersion: '0.57.0' }),
    /version mismatch/i,
  );

  const plan = resolveMonacoAssetPlan({ installedVersion: EXPECTED_VERSION });
  assert.equal(plan.version, EXPECTED_VERSION);
  assert.equal(plan.targetDir, `public/monaco/${EXPECTED_VERSION}/min`);
  assert.equal(plan.vsPath, `/monaco/${EXPECTED_VERSION}/min/vs`);
});

test('asset tree validation requires loader.js and vs/editor/editor.main.js', async () => {
  const { validateMonacoAssetTree } = await import(
    '../scripts/copy-monaco-assets.mjs'
  );

  const complete = ['vs/loader.js', 'vs/editor/editor.main.js'];
  assert.doesNotThrow(() => validateMonacoAssetTree(complete));

  const missingLoader = ['vs/editor/editor.main.js'];
  assert.throws(() => validateMonacoAssetTree(missingLoader), /loader\.js/);

  const missingMain = ['vs/loader.js'];
  assert.throws(
    () => validateMonacoAssetTree(missingMain),
    /editor\.main\.js/,
  );
});

test('configurator applies the vs path exactly once (idempotent)', async () => {
  const mod = await import('../src/lib/monaco-loader.ts');

  const calls = [];
  const fakeLoader = { config: (config) => calls.push(config) };

  mod.applyMonacoLoaderConfig(fakeLoader);
  mod.applyMonacoLoaderConfig(fakeLoader);
  mod.applyMonacoLoaderConfig(fakeLoader);

  assert.equal(calls.length, 1, 'loader.config must run exactly once');
  assert.deepEqual(calls[0], { paths: { vs: mod.MONACO_VS_PATH } });
});
