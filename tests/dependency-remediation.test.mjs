import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const rootPackage = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
const functionPackage = JSON.parse(await readFile(new URL('../appwrite-functions/pdf-generator/package.json', import.meta.url)));

test('pins the audited root packages to their patched releases', () => {
  assert.deepEqual(
    {
      next: rootPackage.dependencies.next,
      eslintConfigNext: rootPackage.devDependencies['eslint-config-next'],
      handlebars: rootPackage.dependencies.handlebars,
      mcp: rootPackage.dependencies['@modelcontextprotocol/sdk'],
      puppeteer: rootPackage.dependencies.puppeteer,
      zod: rootPackage.dependencies.zod,
    },
    {
      next: '16.4.6',
      eslintConfigNext: '16.4.6',
      handlebars: '4.7.10',
      mcp: '1.32.0',
      puppeteer: '25.18.1',
      zod: '4.6.6',
    },
  );
  assert.equal(rootPackage.dependencies['@sparticuz/chromium'], undefined);
  assert.equal(rootPackage.dependencies['puppeteer-core'], undefined);
});

test('pins the PDF function to the same patched template and browser runtime', () => {
  assert.deepEqual(
    {
      handlebars: functionPackage.dependencies.handlebars,
      puppeteer: functionPackage.dependencies.puppeteer,
      node: functionPackage.engines.node,
    },
    { handlebars: '4.7.10', puppeteer: '25.18.1', node: '>=22.12.0' },
  );
  assert.equal(functionPackage.dependencies['@sparticuz/chromium'], undefined);
  assert.equal(functionPackage.dependencies['puppeteer-core'], undefined);
});
