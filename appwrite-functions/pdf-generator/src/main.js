import { Client, TablesDB, Storage, ID } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import puppeteer from 'puppeteer-core';
import Handlebars from 'handlebars';
import { SignJWT } from 'jose';



function registerHbsHelpers() {
    if (Handlebars.helpers["inc"]) return;

    Handlebars.registerHelper("inc", function (value) {
        const n = Number(value);
        return Number.isFinite(n) ? n + 1 : value;
    });

    if (!Handlebars.helpers.default) {
        Handlebars.registerHelper("default", function (value, fallback) {
            return value === undefined || value === null || value === "" ? fallback : value;
        });
    }

    if (!Handlebars.helpers.formatMoney) {
        Handlebars.registerHelper("formatMoney", function (value, options) {
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
    }

    // Comparison helpers
    if (!Handlebars.helpers.eq) Handlebars.registerHelper("eq", (a, b) => a === b);
    if (!Handlebars.helpers.neq) Handlebars.registerHelper("neq", (a, b) => a !== b);
    if (!Handlebars.helpers.gt) Handlebars.registerHelper("gt", (a, b) => a > b);
    if (!Handlebars.helpers.lt) Handlebars.registerHelper("lt", (a, b) => a < b);
    if (!Handlebars.helpers.gte) Handlebars.registerHelper("gte", (a, b) => a >= b);
    if (!Handlebars.helpers.lte) Handlebars.registerHelper("lte", (a, b) => a <= b);

    // Math helpers
    if (!Handlebars.helpers.add) Handlebars.registerHelper("add", (a, b) => Number(a) + Number(b));
    if (!Handlebars.helpers.sub) Handlebars.registerHelper("sub", (a, b) => Number(a) - Number(b));
    if (!Handlebars.helpers.math) {
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
    }

    // Logic
    if (!Handlebars.helpers.and) {
        Handlebars.registerHelper("and", (...args) => {
            const values = args.slice(0, -1);
            return values.every(Boolean);
        });
    }
    if (!Handlebars.helpers.or) {
        Handlebars.registerHelper("or", (...args) => {
            const values = args.slice(0, -1);
            return values.some(Boolean);
        });
    }

    // Formatting
    if (!Handlebars.helpers.uppercase) Handlebars.registerHelper("uppercase", (str) => String(str).toUpperCase());
    if (!Handlebars.helpers.lowercase) Handlebars.registerHelper("lowercase", (str) => String(str).toLowerCase());

    // Date
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
}

const createWebhookRecord = async (tables, db, collectionId, download_id, url, payload, log, error) => {
    if (!url) return;
    try {
        log(`Creating webhook record for: ${url}`);
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
        }
        );
        log('Webhook record created successfully.');
    } catch (err) {
        error(`Failed to create webhook record: ${err.message}`);
    }
};

const main = async ({ req, res, log, error }) => {
    // 0. Environment Check
    const API_KEY = process.env.APPWRITE_API_KEY;
    const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
    const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
    const db = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
    const TEMPLATES_ID = process.env.NEXT_PUBLIC_APPWRITE_TEMPLATES_COLLECTION_ID || "templates";
    const DOCUMENTS_ID = process.env.NEXT_PUBLIC_APPWRITE_DOCUMENTS_COLLECTION_ID || "documents";
    const WEBHOOKS_ID = process.env.NEXT_PUBLIC_APPWRITE_WEBHOOK_COLLECTION_ID || "webhooks"; // New table
    const PDF_BUCKET_ID = "pdfs";
    const JWT_SECRET = process.env.JWT_SECRET;

    // Domain for download URL (optional, fallback to APP_URL or request host if possible, but env is best)
    // const APP_DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_APP_URL || "https://pdfgen.ai";

    // Webhook and Project configuration

    if (!API_KEY || !PROJECT_ID || !db || !JWT_SECRET) {
        error("Missing required environment variables.");
        return res.json({ success: false, error: "Configuration error" }, 500);
    }

    // 1. Initialize Client
    const client = new Client()
        .setEndpoint(ENDPOINT)
        .setProject(PROJECT_ID)
        .setKey(API_KEY);

    const tables = new TablesDB(client);
    const storage = new Storage(client);

    try {
        // 2. Parse Payload
        let payload = req.body;
        if (typeof payload === 'string') {
            try { payload = JSON.parse(payload); } catch { }
        }

        if (!payload || !payload.$id) {
            log("No payload ID found. This function must be triggered by a document create event.");
            return res.json({ success: true, message: "Ignored: No document ID" });
        }

        const download_id = payload.$id;
        const status = payload.status;
        const templateId = payload.template_id;
        const encodedData = payload.data;
        const userId = payload.user_id;
        const name = payload.name;
        // Get webhook callback URL from payload
        const webhookCallback = payload.webhook_callback;

        // ONLY process if status is 'queued'
        if (status !== 'queued') {
            log(`Document ${download_id} is not in 'queued' status (current: ${status}). Skipping.`);
            return res.json({ success: true, message: "Ignored: Status not queued" });
        }

        log(`Starting generation for Document ${download_id} (Template: ${templateId})...`);

        // 3. Fetch Template
        const template = await tables.getRow({
            databaseId: db,
            tableId: TEMPLATES_ID,
            rowId: templateId
        });
        if (!template) {
            throw new Error(`Template ${templateId} not found`);
        }

        // 4. Decode Data
        const inputData = encodedData ? JSON.parse(Buffer.from(encodedData, 'base64').toString('utf-8')) : {};

        // 5. Generate PDF
        registerHbsHelpers();
        const compiledTemplate = Handlebars.compile(template.html || "");
        const htmlContent = compiledTemplate(inputData);
        const cssContent = template.css || "";

        const fullHtml = `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                ${cssContent}
                /* Print tweaks */
                @page { margin: 0; }
                body { margin: 0; -webkit-print-color-adjust: exact; }
            </style>
        </head>
        <body>${htmlContent}</body>
        </html>`;

        // Launch Browser (Fresh instance for reliability in Appwrite runtime)
        // Launch Browser
        const chromiumPath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser';
        log(`Launching Chromium at: ${chromiumPath}`);
        let browser = null;

        try {
            browser = await puppeteer.launch({
                executablePath: chromiumPath,
                headless: true,
                ignoreHTTPSErrors: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--no-zygote',
                    '--disable-gpu',
                    '--single-process',
                ],
            });
            log("Browser launched successfully.");
            log('Browser version: ' + await browser.version());
        } catch (launchErr) {
            error(`CRITICAL: Browser launch failed: ${launchErr.message}`);
            throw launchErr;
        }

        const page = await browser.newPage();
        let pdfBuffer;

        try {
            // SECURITY: Enable Request Interception to block SSRF
            await page.setRequestInterception(true);
            page.on('request', request => {
                const url = request.url();

                if (url.startsWith('data:') || url === 'about:blank') {
                    request.continue();
                    return;
                }

                if (url.startsWith('file:')) {
                    request.abort('accessdenied');
                    return;
                }

                try {
                    const parsed = new URL(url);
                    const hostname = parsed.hostname;

                    if (
                        hostname === 'localhost' ||
                        hostname === '::1' ||
                        hostname === '0.0.0.0' ||
                        hostname.startsWith('127.') ||
                        hostname.startsWith('10.') ||
                        hostname.startsWith('192.168.') ||
                        hostname.startsWith('169.254.')
                    ) {
                        log(`Blocked SSRF attempt to: ${url}`);
                        request.abort('accessdenied');
                        return;
                    }

                    if (hostname.startsWith('172.')) {
                        const parts = hostname.split('.');
                        if (parts.length === 4) {
                            const second = parseInt(parts[1], 10);
                            if (second >= 16 && second <= 31) {
                                log(`Blocked SSRF attempt to: ${url}`);
                                request.abort('accessdenied');
                                return;
                            }
                        }
                    }

                    request.continue();
                } catch {
                    request.abort();
                }
            });

            await page.setContent(fullHtml, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });

            // Wait for fonts to be ready
            await page.evaluate(() => document.fonts ? document.fonts.ready : Promise.resolve());

            // Small settle delay
            await new Promise(resolve => setTimeout(resolve, 300));

            pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
                timeout: 60000
            });
        } finally {
            // ALWAYS close browser and page to prevent connection leaks
            log("Closing page and browser...");
            try { await page.close(); } catch { }
            try { await browser.close(); } catch { }
            log("Browser closed.");
        }

        log(`PDF Generated. Size: ${pdfBuffer.length} bytes.`);

        // 6. Upload to Storage
        const fileId = ID.unique();
        await storage.createFile(
            PDF_BUCKET_ID,
            fileId,
            InputFile.fromBuffer(pdfBuffer, `${name}.pdf`)
        );
        log(`PDF Uploaded: ${fileId}`);

        // 7. Generate Signature
        const secret = new TextEncoder().encode(JWT_SECRET);
        const signature = await new SignJWT({ userId: userId, download_id: download_id })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .sign(secret);

        // 8. Update Document
        const sizeInKb = Math.round(pdfBuffer.length / 1024);

        await tables.updateRow({
            databaseId: db,
            tableId: DOCUMENTS_ID,
            rowId: download_id,
            data: {
                status: 'completed',
                pdf_file: fileId,
                size: sizeInKb,
                signature: signature
            }
        });
        log(`Document ${download_id} updated to 'completed'.`);

        // 9. NEW: Create Webhook Record (Success)
        if (webhookCallback) {
            const webhookData = {
                success: true,
                download_id: download_id,
                status: "completed",
                download_url: `${ENDPOINT.replace('/v1', '')}/storage/buckets/${PDF_BUCKET_ID}/files/${fileId}/view?project=${PROJECT_ID}`,
                name: name,
                size: sizeInKb
            };
            await createWebhookRecord(tables, db, WEBHOOKS_ID, download_id, webhookCallback, webhookData, log, error);
        }

        return res.json({
            success: true,
            download_id: download_id,
            fileId: fileId,
            size: sizeInKb
        });

    } catch (err) {
        error(`Error generating PDF for ${req.body?.$id || 'unknown'}: ${err.message}`);

        // Attempt to mark as failed if we have an ID
        if (req.body?.$id) {

            // Re-extract webhook callback
            let payload = req.body;
            if (typeof payload === 'string') {
                try { payload = JSON.parse(payload); } catch { }
            }
            const webhookCallback = payload?.webhook_callback;

            // Send Failure Webhook via DB Record
            if (webhookCallback) {
                const failureData = {
                    success: false,
                    download_id: req.body.$id,
                    status: "failed",
                    error: err.message
                };
                await createWebhookRecord(tables, db, WEBHOOKS_ID, req.body.$id, webhookCallback, failureData, log, error);
            }

            try {
                await tables.updateRow({
                    databaseId: db,
                    tableId: DOCUMENTS_ID,
                    rowId: req.body.$id,
                    data: {
                        status: 'failed',
                        error_message: err.message
                    }
                });
            } catch (updateErr) {
                error(`Failed to update status to failed: ${updateErr.message}`);
            }
        }

        // Errors handled, ensure we don't leave zombie processes
        return res.json({ success: false, error: err.message }, 500);
    }
};

export default main;
