import { URL } from 'url';

const PRIVATE_HOST_RE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|::1$)/i;
const ASSET_CACHE = new Map(); // Shared cache for ONE execution (or across warm starts if desired)

function isPrivateOrLocalHostname(hostname) {
    if (!hostname) return true;
    if (PRIVATE_HOST_RE.test(hostname)) return true;
    if (/^172\./.test(hostname)) {
        const parts = hostname.split('.');
        if (parts.length >= 2) {
            const second = Number(parts[1]);
            if (second >= 16 && second <= 31) return true;
        }
    }
    return false;

}

function assertSafeUrl(urlStr, { allowHosts } = {}) {
    const u = new URL(urlStr);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
        throw new Error(`Blocked non-http(s) url: ${urlStr}`);
    }
    const host = u.hostname;

    if (allowHosts && Array.isArray(allowHosts) && allowHosts.length) {
        if (!allowHosts.includes(host)) {
            throw new Error(`Blocked host not in allowlist: ${host}`);
        }
    } else {
        if (isPrivateOrLocalHostname(host)) {
            throw new Error(`Blocked private/local host: ${host}`);
        }
    }
    return u;
}

async function fetchWithRetry(urlStr, opts = {}, retries = 2) {
    if (ASSET_CACHE.has(urlStr)) return ASSET_CACHE.get(urlStr);

    const u = assertSafeUrl(urlStr, opts);
    let lastError;

    for (let i = 0; i <= retries; i++) {
        try {
            const res = await fetch(u.toString(), { redirect: 'follow' });
            if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${u}`);

            const contentType = res.headers.get('content-type') || 'application/octet-stream';
            const arrayBuffer = await res.arrayBuffer();
            const result = { buf: Buffer.from(arrayBuffer), contentType, finalUrl: u.toString() };

            // Basic size limit check (default 5MB per asset)
            const maxBytes = opts.maxAssetBytes || 5 * 1024 * 1024;
            if (result.buf.length > maxBytes) {
                throw new Error(`Asset too large: ${urlStr} (${result.buf.length} bytes)`);
            }

            ASSET_CACHE.set(urlStr, result);
            return result;
        } catch (err) {
            lastError = err;
            if (i < retries) {
                // Exponential backoff could be added here, but simple retry is fine for now
                await new Promise(r => setTimeout(r, 200 * (i + 1)));
            }
        }
    }
    throw lastError;
}

function toDataUrl(buf, contentType) {
    return `data:${contentType};base64,${buf.toString('base64')}`;
}

function resolveUrl(raw, baseUrl) {
    try { return new URL(raw, baseUrl).toString(); } catch { return null; }
}

async function inlineCssImports(cssText, baseUrl, opts, seen = new Set()) {
    const importRe = /@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;/gi;
    const matches = [...cssText.matchAll(importRe)];
    let out = cssText;

    for (const m of matches) {
        const raw = m[1];
        const abs = resolveUrl(raw, baseUrl);
        if (!abs || seen.has(abs)) {
            out = out.replace(m[0], '');
            continue;
        }
        seen.add(abs);

        try {
            const { buf } = await fetchWithRetry(abs, opts);
            const text = buf.toString('utf8');
            const inlined = await inlineCssImports(text, abs, opts, seen);
            out = out.replace(m[0], inlined);
        } catch (e) {
            console.error(`CSS Import inlining failed for ${abs}: ${e.message}`);
            out = out.replace(m[0], '');
        }
    }
    return out;
}

async function inlineCssUrls(cssText, baseUrl, opts) {
    const urlRe = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
    const urls = new Map();
    for (const m of cssText.matchAll(urlRe)) {
        const raw = m[2];
        if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) continue;
        const abs = resolveUrl(raw, baseUrl);
        if (!abs) continue;
        if (!urls.has(abs)) urls.set(abs, raw);
    }

    let out = cssText;
    await Promise.all([...urls.keys()].map(async (abs) => {
        try {
            const { buf, contentType } = await fetchWithRetry(abs, opts);
            const dataUrl = toDataUrl(buf, contentType);
            out = out.split(abs).join(dataUrl);
            // Also split by original relative path just in case
            const original = urls.get(abs);
            if (original) out = out.split(original).join(dataUrl);
        } catch (e) {
            console.error(`CSS resource inlining failed for ${abs}: ${e.message}`);
        }
    }));

    return out;
}

async function inlineHtmlStylesheets(html, baseUrl, opts) {
    const linkRe = /<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi;
    const hrefRe = /\bhref=["']([^"']+)["']/i;

    const links = [...html.matchAll(linkRe)];
    let cssBundleItems = [];

    await Promise.all(links.map(async (m) => {
        const tag = m[0];
        const hm = tag.match(hrefRe);
        if (!hm) return;
        const href = hm[1];
        const abs = resolveUrl(href, baseUrl);
        if (!abs) return;

        try {
            const { buf, finalUrl } = await fetchWithRetry(abs, opts);
            let css = buf.toString('utf8');
            css = await inlineCssImports(css, finalUrl, opts);
            css = await inlineCssUrls(css, finalUrl, opts);
            cssBundleItems.push({ tag, css: `\n/* inlined: ${finalUrl} */\n${css}\n` });
        } catch (e) {
            console.error(`Stylesheet inlining failed for ${abs}: ${e.message}`);
        }
    }));

    let out = html;
    let combinedCss = '';
    for (const item of cssBundleItems) {
        out = out.replace(item.tag, '');
        combinedCss += item.css;
    }

    if (combinedCss) {
        if (/<\/head>/i.test(out)) {
            out = out.replace(/<\/head>/i, `<style>${combinedCss}</style></head>`);
        } else {
            out = `<head><style>${combinedCss}</style></head>` + out;
        }
    }

    return out;
}

async function inlineHtmlImages(html, baseUrl, opts) {
    const imgRe = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
    const srcs = new Set();

    for (const m of html.matchAll(imgRe)) {
        const src = m[1];
        if (!src || src.startsWith('data:') || src.startsWith('blob:')) continue;
        const abs = resolveUrl(src, baseUrl);
        if (!abs) continue;
        srcs.add(abs);
    }

    const entries = [...srcs];
    const cacheMap = new Map();
    await Promise.all(entries.map(async (abs) => {
        try {
            const { buf, contentType } = await fetchWithRetry(abs, opts);
            cacheMap.set(abs, toDataUrl(buf, contentType));
        } catch (e) {
            console.error(`Image inlining failed for ${abs}: ${e.message}`);
        }
    }));

    let out = html;
    for (const [abs, dataUrl] of cacheMap.entries()) {
        out = out.split(abs).join(dataUrl);
    }
    return out;
}

export async function makeHtmlSelfContained(fullHtml, options = {}) {
    const {
        baseUrl = 'https://cloud.appwrite.io/',
        allowHosts = null,
        inlineStylesheets = true,
        inlineImages = true,
        clearCache = false
    } = options;

    if (clearCache) ASSET_CACHE.clear();

    const opts = { allowHosts, maxAssetBytes: options.maxAssetBytes };
    let html = fullHtml;

    if (inlineStylesheets) {
        html = await inlineHtmlStylesheets(html, baseUrl, opts);
    }

    const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    const styles = [...html.matchAll(styleRe)];
    for (const s of styles) {
        const css = s[1];
        try {
            const inlined = await inlineCssUrls(css, baseUrl, opts);
            html = html.replace(s[0], `<style>${inlined}</style>`);
        } catch (e) {
            console.error(`Internal style inlining failed: ${e.message}`);
        }
    }

    if (inlineImages) {
        html = await inlineHtmlImages(html, baseUrl, opts);
    }

    return html;
}
