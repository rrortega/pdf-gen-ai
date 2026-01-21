import { Client, Databases, Storage, ID, InputFile } from 'node-appwrite';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import Handlebars from 'handlebars';
import { SignJWT } from 'jose';

// Helper: Register Handlebars Helpers (Stripped from src/lib/hbs.ts)
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

export default async ({ req, res, log, error }) => {
    // 0. Environment Check
    const API_KEY = process.env.APPWRITE_API_KEY;
    const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
    const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
    const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
    const TEMPLATES_ID = process.env.NEXT_PUBLIC_APPWRITE_TEMPLATES_COLLECTION_ID || "templates";
    const DOCUMENTS_ID = process.env.NEXT_PUBLIC_APPWRITE_DOCUMENTS_COLLECTION_ID || "documents";
    const PDF_BUCKET_ID = "pdfs"; // Assuming 'pdfs' based on previous context
    const JWT_SECRET = process.env.JWT_SECRET;

    if (!API_KEY || !PROJECT_ID || !DATABASE_ID || !JWT_SECRET) {
        error("Missing required environment variables.");
        return res.json({ success: false, error: "Configuration error" }, 500);
    }

    // 1. Initialize Client
    const client = new Client()
        .setEndpoint(ENDPOINT)
        .setProject(PROJECT_ID)
        .setKey(API_KEY);

    const db = new Databases(client);
    const storage = new Storage(client);

    try {
        // 2. Parse Payload
        // Standard Appwrite Event payload is inside req.body
        let payload = req.body;

        // If coming from body as string (sometimes happens in testing or different runtimes)
        if (typeof payload === 'string') {
            try { payload = JSON.parse(payload); } catch (e) { }
        }

        if (!payload || !payload.$id) {
            log("No payload ID found. This function must be triggered by a document create event.");
            return res.json({ success: true, message: "Ignored: No document ID" });
        }

        const documentId = payload.$id;
        const status = payload.status;
        const templateId = payload.template_id;
        const encodedData = payload.data;
        const userId = payload.user_id;
        const name = payload.name;

        // ONLY process if status is 'queued'
        if (status !== 'queued') {
            log(`Document ${documentId} is not in 'queued' status (current: ${status}). Skipping.`);
            return res.json({ success: true, message: "Ignored: Status not queued" });
        }

        log(`Starting generation for Document ${documentId} (Template: ${templateId})...`);

        // 3. Fetch Template
        const template = await db.getDocument(DATABASE_ID, TEMPLATES_ID, templateId);
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

        // Launch Browser
        // Use @sparticuz/chromium for AWS Lambda / Appwrite Functions environments
        const browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();
        await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
        });

        await browser.close();
        log(`PDF Generated. Size: ${pdfBuffer.length} bytes.`);

        // 6. Upload to Storage
        const fileId = ID.unique();
        const file = await storage.createFile(
            PDF_BUCKET_ID,
            fileId,
            InputFile.fromBuffer(pdfBuffer, `${name}.pdf`)
        );
        log(`PDF Uploaded: ${fileId}`);

        // 7. Generate Signature
        const secret = new TextEncoder().encode(JWT_SECRET);
        const signature = await new SignJWT({ userId: userId, documentId: documentId })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .sign(secret);

        // 8. Update Document
        await db.updateDocument(
            DATABASE_ID,
            DOCUMENTS_ID,
            documentId,
            {
                status: 'completed',
                pdf_file: fileId,
                size: Math.round(pdfBuffer.length / 1024),
                signature: signature
            }
        );
        log(`Document ${documentId} updated to 'completed'.`);

        return res.json({
            success: true,
            documentId: documentId,
            fileId: fileId,
            size: Math.round(pdfBuffer.length / 1024)
        });

    } catch (err) {
        error(`Error generating PDF for ${req.body?.$id || 'unknown'}: ${err.message}`);

        // Attempt to mark as failed if we have an ID
        if (req.body?.$id) {
            try {
                await db.updateDocument(
                    DATABASE_ID,
                    DOCUMENTS_ID,
                    req.body.$id,
                    {
                        status: 'failed',
                        error_message: err.message
                    }
                );
            } catch (updateErr) {
                error(`Failed to update status to failed: ${updateErr.message}`);
            }
        }

        return res.json({ success: false, error: err.message }, 500);
    }
};
