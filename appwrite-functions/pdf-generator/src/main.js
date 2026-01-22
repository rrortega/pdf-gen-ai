import { Client, TablesDB, Storage, ID } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import Handlebars from 'handlebars';
import { SignJWT } from 'jose';
import { makeHtmlSelfContained } from './inline-assets.js';

// --- Warm Start Optimization: Global State ---
const TEMPLATE_CACHE = new Map();
let HELPERS_REGISTERED = false;

function registerHbsHelpers() {
    if (HELPERS_REGISTERED) return;

    Handlebars.registerHelper("inc", (value) => {
        const n = Number(value);
        return Number.isFinite(n) ? n + 1 : value;
    });

    Handlebars.registerHelper("default", (value, fallback) => {
        return value === undefined || value === null || value === "" ? fallback : value;
    });

    Handlebars.registerHelper("formatMoney", (value, options) => {
        const num = Number(value);
        if (!Number.isFinite(num)) return value;
        const prefix = options.hash.prefix || "";
        const suffix = options.hash.suffix || "";
        const precision = options.hash.precision !== undefined ? options.hash.precision : 2;
        const thousands = options.hash.thousands || ",";
        const decimal = options.hash.decimal || ".";
        const fixed = num.toFixed(precision);
        const parts = fixed.split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
        return prefix + parts.join(decimal) + suffix;
    });

    // Comparison & Logic
    Handlebars.registerHelper("eq", (a, b) => a === b);
    Handlebars.registerHelper("neq", (a, b) => a !== b);
    Handlebars.registerHelper("gt", (a, b) => a > b);
    Handlebars.registerHelper("lt", (a, b) => a < b);
    Handlebars.registerHelper("gte", (a, b) => a >= b);
    Handlebars.registerHelper("lte", (a, b) => a <= b);
    Handlebars.registerHelper("and", (...args) => args.slice(0, -1).every(Boolean));
    Handlebars.registerHelper("or", (...args) => args.slice(0, -1).some(Boolean));

    // Math
    Handlebars.registerHelper("add", (a, b) => Number(a) + Number(b));
    Handlebars.registerHelper("sub", (a, b) => Number(a) - Number(b));
    Handlebars.registerHelper("math", (lvalue, operator, rvalue) => {
        const l = Number(lvalue);
        const r = Number(rvalue);
        if (isNaN(l) || isNaN(r)) return 0;
        switch (operator) {
            case "+": return l + r;
            case "-": return l - r;
            case "*": return l * r;
            case "/": return l / r;
            case "%": return l % r;
            default: return 0;
        }
    });

    Handlebars.registerHelper("uppercase", (str) => String(str).toUpperCase());
    Handlebars.registerHelper("lowercase", (str) => String(str).toLowerCase());

    Handlebars.registerHelper("date", (date, format) => {
        if (!date) return "";
        const d = new Date(date);
        if (isNaN(d.getTime())) return date;
        if (typeof format !== 'string') return d.toLocaleDateString();
        const map = {
            '%m': String(d.getMonth() + 1).padStart(2, '0'),
            '%d': String(d.getDate()).padStart(2, '0'),
            '%Y': String(d.getFullYear()),
            '%H': String(d.getHours()).padStart(2, '0'),
            '%M': String(d.getMinutes()).padStart(2, '0'),
            '%S': String(d.getSeconds()).padStart(2, '0'),
            '%y': String(d.getFullYear()).slice(-2),
        };
        return format.replace(/%[mYdHMSy]/g, (match) => map[match] || match);
    });

    HELPERS_REGISTERED = true;
}

// Pre-initialize helpers
registerHbsHelpers();

// --- Utilities ---

const createWebhookRecord = async (tables, db, collectionId, download_id, url, payload, log, error) => {
    if (!url) return;
    try {
        log(`Creating webhook record: ${url}`);
        await tables.createRow({
            databaseId: db,
            tableId: collectionId,
            rowId: ID.unique(),
            data: {
                document_id: download_id,
                url: url,
                retry: 0,
                status: "pending",
                response: null,
                payload: typeof payload === 'object' ? JSON.stringify(payload) : payload,
                execution_time: 0
            }
        });
    } catch (err) {
        error(`Webhook record failed: ${err.message}`);
    }
};

const validateEnv = () => {
    const required = [
        'APPWRITE_API_KEY',
        'NEXT_PUBLIC_APPWRITE_PROJECT_ID',
        'NEXT_PUBLIC_APPWRITE_DATABASE_ID',
        'JWT_SECRET'
    ];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) throw new Error(`Missing environment variables: ${missing.join(', ')}`);

    return {
        API_KEY: process.env.APPWRITE_API_KEY,
        ENDPOINT: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1",
        PROJECT_ID: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
        DATABASE_ID: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        TEMPLATES_ID: process.env.NEXT_PUBLIC_APPWRITE_TEMPLATES_COLLECTION_ID || "templates",
        DOCUMENTS_ID: process.env.NEXT_PUBLIC_APPWRITE_DOCUMENTS_COLLECTION_ID || "documents",
        WEBHOOKS_ID: process.env.NEXT_PUBLIC_APPWRITE_WEBHOOK_COLLECTION_ID || "webhooks",
        JWT_SECRET: process.env.JWT_SECRET,
        BASE_URL: process.env.ASSETS_BASE_URL || 'https://cloud.appwrite.io',
        ALLOW_HOSTS: process.env.ASSETS_ALLOW_HOSTS?.split(',').map(s => s.trim()).filter(Boolean) || null,
        PDF_BUCKET_ID: "pdfs"
    };
};

// --- Main Handler ---

const main = async ({ req, res, log, error }) => {
    let browser = null;
    let env;

    try {
        env = validateEnv();
    } catch (e) {
        error(e.message);
        return res.json({ success: false, error: "Configuration error" }, 500);
    }

    const client = new Client().setEndpoint(env.ENDPOINT).setProject(env.PROJECT_ID).setKey(env.API_KEY);
    const tables = new TablesDB(client);
    const storage = new Storage(client);

    try {
        // 1. Parse & Validate Payload
        let payload = req.body;
        if (typeof payload === 'string') {
            try { payload = JSON.parse(payload); } catch { }
        }

        if (!payload || !payload.$id) {
            log("Ignored: No document ID.");
            return res.json({ success: true, message: "Ignored: No document ID" });
        }

        const download_id = payload.$id;
        if (payload.status !== 'queued') {
            log(`Skipped: Status is ${payload.status}`);
            return res.json({ success: true, message: "Ignored: Not queued" });
        }

        log(`Generating PDF for ${download_id} (Template: ${payload.template_id})...`);

        // 2. Fetch & Compile Template (with Cache)
        let compiledTemplate = TEMPLATE_CACHE.get(payload.template_id);
        if (!compiledTemplate) {
            const template = await tables.getRow({
                databaseId: env.DATABASE_ID,
                tableId: env.TEMPLATES_ID,
                rowId: payload.template_id
            });
            if (!template) throw new Error(`Template ${payload.template_id} not found`);

            compiledTemplate = {
                render: Handlebars.compile(template.html || ""),
                css: template.css || ""
            };
            TEMPLATE_CACHE.set(payload.template_id, compiledTemplate);
        }

        // 3. Process Content
        const inputData = payload.data ? JSON.parse(Buffer.from(payload.data, 'base64').toString('utf-8')) : {};
        const htmlBody = compiledTemplate.render(inputData);

        const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${compiledTemplate.css} @page { margin: 0; } body { margin: 0; -webkit-print-color-adjust: exact; }</style></head><body>${htmlBody}</body></html>`;

        log('Inlining assets...');
        const startInline = Date.now();
        const selfContainedHtml = await makeHtmlSelfContained(fullHtml, {
            baseUrl: env.BASE_URL,
            allowHosts: env.ALLOW_HOSTS,
            // Clear internal cache every few runs or based on time to prevent memory leaks in extreme cases
            clearCache: Math.random() < 0.05
        });
        log(`Inlining done in ${Date.now() - startInline}ms`);

        // 4. Puppeteer Rendering
        browser = await puppeteer.launch({
            args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--disable-gpu'],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on('request', r => {
            const u = r.url();
            (u.startsWith('data:') || u === 'about:blank') ? r.continue() : r.abort();
        });

        await page.setContent(selfContainedHtml, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.evaluate(() => document.fonts ? document.fonts.ready : Promise.resolve());

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
        });

        // 5. Success Flow
        const fileId = ID.unique();
        await storage.createFile(env.PDF_BUCKET_ID, fileId, InputFile.fromBuffer(pdfBuffer, `${payload.name || 'document'}.pdf`));

        const secret = new TextEncoder().encode(env.JWT_SECRET);
        const signature = await new SignJWT({ userId: payload.user_id, download_id }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().sign(secret);
        const sizeInKb = Math.round(pdfBuffer.length / 1024);

        await tables.updateRow({
            databaseId: env.DATABASE_ID,
            tableId: env.DOCUMENTS_ID,
            rowId: download_id,
            data: { status: 'completed', pdf_file: fileId, size: sizeInKb, signature }
        });

        if (payload.webhook_callback) {
            const webhookData = {
                success: true,
                download_id,
                status: "completed",
                download_url: `${env.ENDPOINT.replace('/v1', '')}/storage/buckets/${env.PDF_BUCKET_ID}/files/${fileId}/view?project=${env.PROJECT_ID}`,
                name: payload.name,
                size: sizeInKb
            };
            await createWebhookRecord(tables, env.DATABASE_ID, env.WEBHOOKS_ID, download_id, payload.webhook_callback, webhookData, log, error);
        }

        return res.json({ success: true, download_id, fileId, size: sizeInKb });

    } catch (err) {
        error(`Failed: ${err.message}`);

        if (req.body?.$id) {
            const download_id = req.body.$id;
            try {
                // Determine if we have a webhook callback to notify failure
                let p = req.body;
                if (typeof p === 'string') try { p = JSON.parse(p); } catch { }

                if (p?.webhook_callback) {
                    await createWebhookRecord(tables, env?.DATABASE_ID || process.env.DATABASE_ID, env?.WEBHOOKS_ID || "webhooks", download_id, p.webhook_callback, { success: false, download_id, status: "failed", error: err.message }, log, error);
                }

                await tables.updateRow({
                    databaseId: env?.DATABASE_ID || process.env.DATABASE_ID,
                    tableId: env?.DOCUMENTS_ID || "documents",
                    rowId: download_id,
                    data: { status: 'failed', error_message: err.message }
                });
            } catch (failErr) {
                error(`Recovery failed: ${failErr.message}`);
            }
        }
        return res.json({ success: false, error: err.message }, 500);
    } finally {
        if (browser) await browser.close().catch(() => { });
    }
};

export default main;
