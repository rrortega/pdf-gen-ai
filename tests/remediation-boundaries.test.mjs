import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

const { renderHbsHtml, TemplateHtmlError } = await import('../src/lib/hbs.ts');
const { parseMcpRequest, McpInputError } = await import('../src/lib/mcp-input.ts');

const MIB = 1024 * 1024;

test('template HTML accepts exactly one MiB and rejects one byte more', () => {
  assert.doesNotThrow(() => renderHbsHtml('x'.repeat(MIB), {}));
  assert.throws(() => renderHbsHtml('x'.repeat(MIB + 1), {}), TemplateHtmlError);
});

test('template size limit is measured in bytes, not characters', () => {
  assert.throws(() => renderHbsHtml('é'.repeat(600_000), {}), /exceeds 1 MiB/);
});

test('the shared helper registry still renders after validation', () => {
  assert.equal(
    renderHbsHtml('{{uppercase a}}-{{formatMoney 1234.5 prefix="$"}}', { a: 'x' }),
    'X-$1,234.50',
  );
});

test('MCP accepts a ten-message batch and rejects eleven or an empty batch', () => {
  const one = { jsonrpc: '2.0', id: 1, method: 'tools/list' };

  assert.equal(parseMcpRequest(JSON.stringify(Array(10).fill(one))).length, 10);
  assert.throws(() => parseMcpRequest(JSON.stringify(Array(11).fill(one))), McpInputError);
  assert.throws(() => parseMcpRequest('[]'), /between 1 and 10/);
});

test('MCP generate_pdf data accepts depth eight and rejects depth nine', () => {
  const nest = (depth) => {
    let value = 1;
    for (let index = 0; index < depth; index += 1) value = { child: value };
    return value;
  };
  const message = (depth) =>
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'generate_pdf', arguments: { template_id: 't', name: 'n', data: nest(depth) } },
    });

  assert.doesNotThrow(() => parseMcpRequest(message(8)));
  assert.throws(() => parseMcpRequest(message(9)), /too deeply nested/);
});

test('the shipped Monaco bundle carries a patched DOMPurify', () => {
  const directory = 'node_modules/monaco-editor/min/vs';
  const bundle = readdirSync(directory)
    .filter((file) => file.startsWith('editor-'))
    .map((file) => readFileSync(`${directory}/${file}`, 'utf8'))
    .join('');

  assert.match(bundle, /version="3\.4\.1[7-9]"/);
  assert.doesNotMatch(bundle, /version="3\.4\.15"/);
});

test('the copy step is chained into build and dev', () => {
  const manifest = JSON.parse(readFileSync('package.json', 'utf8'));

  for (const script of ['build', 'dev']) {
    assert.match(manifest.scripts[script], /^node scripts\/copy-monaco-assets\.mjs && /);
  }
});

function makeCopyProject({ pin, installedVersion, entries = ['vs/loader.js', 'vs/editor/editor.main.js'] }) {
  const root = mkdtempSync(join(tmpdir(), 'monaco-copy-'));
  mkdirSync(join(root, 'scripts'), { recursive: true });
  copyFileSync('scripts/copy-monaco-assets.mjs', join(root, 'scripts/copy-monaco-assets.mjs'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: { 'monaco-editor': pin } }));
  mkdirSync(join(root, 'node_modules/monaco-editor'), { recursive: true });
  writeFileSync(
    join(root, 'node_modules/monaco-editor/package.json'),
    JSON.stringify({ version: installedVersion }),
  );

  const minDir = join(root, 'node_modules/monaco-editor/min');
  for (const entry of entries) {
    mkdirSync(dirname(join(minDir, entry)), { recursive: true });
    writeFileSync(join(minDir, entry), 'stub');
  }

  return root;
}

test('running the copy step really publishes the versioned asset tree', () => {
  const root = makeCopyProject({ pin: '1.2.3', installedVersion: '1.2.3' });

  try {
    const output = execFileSync('node', [join(root, 'scripts/copy-monaco-assets.mjs')], {
      encoding: 'utf8',
    });

    assert.match(output, /public\/monaco\/1\.2\.3\/min/);
    assert.equal(
      readFileSync(join(root, 'public/monaco/1.2.3/min/vs/loader.js'), 'utf8'),
      'stub',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the copy step exits non-zero when the installed version drifts from the pin', () => {
  const root = makeCopyProject({ pin: '1.2.3', installedVersion: '1.2.4' });

  try {
    assert.throws(
      () => execFileSync('node', [join(root, 'scripts/copy-monaco-assets.mjs')], { encoding: 'utf8', stdio: 'pipe' }),
      (error) => {
        assert.equal(error.status, 1);
        assert.match(String(error.stderr), /version mismatch/);
        return true;
      },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
