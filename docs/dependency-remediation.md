# Dependency remediation

T8 updates the audited direct dependencies to exact patched releases: Next.js and
`eslint-config-next` 16.4.6, Handlebars 4.7.10, MCP SDK 1.32.0, Puppeteer
25.18.1, and Zod 4.6.6. The root and Appwrite PDF function lockfiles make the
browser and template runtime reproducible.

## Browser provisioning

Puppeteer 25.18.1 pins Chrome for Testing `157.0.8103.78`. Both PDF runtimes
use the `puppeteer` package, so its install script downloads that supported
revision rather than combining `puppeteer-core` with a separate Sparticuz
binary. The root cache is `.cache/puppeteer` and is included in Docker at
`/app/.cache/puppeteer`; the Appwrite function keeps its cache at
`appwrite-functions/pdf-generator/.cache/puppeteer` during its build.

Use Node.js 22.12 or newer. `PUPPETEER_EXECUTABLE_PATH` remains an explicit
runtime override for a verified compatible executable. Do not set a skip
-download variable unless that override is supplied.

The Docker build runs `npm ci`, which runs Puppeteer's package install script.
For an Appwrite function deployment, use the normal `npm install` build step;
its package configuration enables the same managed browser download.

## Monaco editor assets

The browser editor (via `@monaco-editor/react`) previously defaulted to loading
Monaco from `cdn.jsdelivr.net`, which served an unpinned third-party asset tree.
`monaco-editor` is now pinned to exactly `0.58.0-dev-20261111` (registry `next`
tag), whose vendored DOMPurify is 3.4.17 — outside both low advisories that
affected the 0.57.0 pin (DOMPurify 3.4.15). The `overrides` entry in
`package.json` repeats the exact same spec because `@monaco-editor/react`
declares the peer range `>= 0.25.0 < 1`, which rejects any prerelease; the
override changes no resolved version and keeps `npm ci` reproducible.

`scripts/copy-monaco-assets.mjs` copies the installed `monaco-editor/min` tree
to `public/monaco/<version>/min` (gitignored, never committed). It fails
loudly when the installed version differs from the `package.json` pin or when
the copied tree is missing `vs/loader.js` or `vs/editor/editor.main.js`. Both
`npm run dev` and `npm run build` run the script first (plus the
`predev`/`prebuild` lifecycle hooks for environments that enable pre/post
scripts), so every build ships same-origin assets.

`src/lib/monaco-loader.ts` points the loader at
`/monaco/0.58.0-dev-20261111/min/vs` exactly once before any editor mount, in
`CodeEditor.tsx` and `IntegrationModal.tsx`. No editor request reaches a
third-party CDN; the shipped `editor.main` bundle carries the
`version="3.4.17"` DOMPurify banner as provenance.

## Input boundaries

Root Handlebars rendering accepts only strings up to 1 MiB before compilation.
The MCP route bounds requests to 1 MiB, batches to ten messages, and
`generate_pdf.data` to depth eight and 1,000 elements. Existing valid template
syntax and MCP tool response shapes are unchanged.
