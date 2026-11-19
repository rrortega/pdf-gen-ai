#!/usr/bin/env node
// Copies the installed monaco-editor min/ asset tree into a versioned,
// same-origin public path so @monaco-editor/loader never fetches Monaco
// (and its vendored DOMPurify) from a third-party CDN.
//
// The generated tree (public/monaco/<version>/) is gitignored; run this
// through the `predev`/`prebuild` npm lifecycle hooks before every build.

import { cpSync, existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');

const EXPECTED_ENTRIES = ['vs/loader.js', 'vs/editor/editor.main.js'];

/**
 * Pure decision logic for the copy step so tests need no filesystem.
 * Throws when the installed monaco-editor version differs from the pin
 * in package.json, refusing to ship mismatched assets.
 */
export function resolveMonacoAssetPlan({
  expectedVersion = getExpectedMonacoVersion(),
  installedVersion,
} = {}) {
  if (!installedVersion) {
    throw new Error('monaco-editor is not installed (no version found)');
  }
  if (installedVersion !== expectedVersion) {
    throw new Error(
      `monaco-editor version mismatch: expected ${expectedVersion} (package.json pin), ` +
        `installed ${installedVersion}. Re-run \`npm install\` instead of copying mismatched assets.`,
    );
  }
  return {
    version: installedVersion,
    sourceDir: `node_modules/monaco-editor/min`,
    targetDir: `public/monaco/${installedVersion}/min`,
    vsPath: `/monaco/${installedVersion}/min/vs`,
  };
}

/** Refuses a copied tree that is missing the entries the loader needs. */
export function validateMonacoAssetTree(entries, expectedEntries = EXPECTED_ENTRIES) {
  const missing = expectedEntries.filter((entry) => !entries.includes(entry));
  if (missing.length > 0) {
    throw new Error(
      `copied monaco asset tree is incomplete; missing: ${missing.join(', ')}`,
    );
  }
}

function getExpectedMonacoVersion() {
  const packageJson = JSON.parse(
    readFileSync(join(rootDir, 'package.json'), 'utf8'),
  );
  const pin = packageJson.dependencies?.['monaco-editor'];
  if (!pin) {
    throw new Error('package.json has no monaco-editor dependency to pin against');
  }
  if (!/^[0-9]/.test(pin) || /[\^~><=]/.test(pin)) {
    throw new Error(`package.json monaco-editor pin must be exact, got "${pin}"`);
  }
  return pin;
}

function getInstalledMonacoVersion() {
  const packageJsonPath = join(rootDir, 'node_modules/monaco-editor/package.json');
  if (!existsSync(packageJsonPath)) {
    return undefined;
  }
  return JSON.parse(readFileSync(packageJsonPath, 'utf8')).version;
}

function collectRelativeFiles(dir, prefix = '') {
  const entries = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${name.name}` : name.name;
    if (name.isDirectory()) {
      entries.push(...collectRelativeFiles(join(dir, name.name), relative));
    } else {
      entries.push(relative);
    }
  }
  return entries;
}

function run() {
  const plan = resolveMonacoAssetPlan({ installedVersion: getInstalledMonacoVersion() });
  const sourceDir = join(rootDir, plan.sourceDir);
  const targetDir = join(rootDir, plan.targetDir);

  if (!existsSync(sourceDir)) {
    throw new Error(`installed monaco-editor has no min/ tree at ${plan.sourceDir}`);
  }

  cpSync(sourceDir, targetDir, { recursive: true });

  const copied = collectRelativeFiles(targetDir);
  validateMonacoAssetTree(copied);

  const totalBytes = copied.reduce((sum, relative) => {
    return sum + readFileSync(join(targetDir, relative)).byteLength;
  }, 0);

  console.log(
    `monaco-editor ${plan.version}: copied ${copied.length} files ` +
      `(${(totalBytes / 1024 / 1024).toFixed(1)} MiB) to ${plan.targetDir} ` +
      `(loader vs path: ${plan.vsPath})`,
  );
}

// Compare real paths: symlinked locations such as macOS /var -> /private/var, or a
// project mounted through a symlink, must still run the copy step.
function isEntryPoint() {
  const invoked = process.argv[1];
  if (!invoked) {
    return false;
  }

  try {
    return realpathSync(resolve(invoked)) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  try {
    run();
  } catch (error) {
    console.error(`copy-monaco-assets: ${error.message}`);
    process.exit(1);
  }
}
