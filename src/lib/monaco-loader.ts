// Client-only Monaco loader configuration.
//
// @monaco-editor/react (through @monaco-editor/loader) defaults to loading
// Monaco from cdn.jsdelivr.net. That would run an unpinned third-party asset
// tree in the browser, bypassing the audited monaco-editor version in
// package.json. This module points the loader at the same-origin, versioned
// asset tree produced by scripts/copy-monaco-assets.mjs before any Editor
// mounts.
import { loader } from "@monaco-editor/react";

export const MONACO_VERSION = "0.58.0-dev-20261111";
export const MONACO_VS_PATH = `/monaco/${MONACO_VERSION}/min/vs`;

let configured = false;

/**
 * Applies loader.config exactly once. Exposed with an injectable loader API
 * so tests can verify single-application behavior offline.
 */
export function applyMonacoLoaderConfig(
    loaderApi: Pick<typeof loader, "config"> = loader,
) {
    if (configured) return;
    loaderApi.config({ paths: { vs: MONACO_VS_PATH } });
    configured = true;
}

/**
 * Configures the loader before any Editor mount. Safe to import from client
 * components rendered during SSR: the browser-only config is skipped on the
 * server, where no Monaco assets are fetched.
 */
export function ensureMonacoLoaderConfigured() {
    if (typeof window === "undefined") return;
    applyMonacoLoaderConfig();
}
