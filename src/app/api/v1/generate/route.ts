import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import {
    DATABASE_ID,
    COLLECTIONS,
} from "@/lib/appwrite";
import { PDFGenerator } from "@/lib/pdf-generator";
import { ID, Permission, Role } from "node-appwrite";
import { getAuthenticatedDatabases } from "@/lib/auth";
import { SignJWT } from "jose";
import { validateWebhookUrl } from "@/lib/security";
import { isPostgresBackend } from "@/backend/config";
import { generatePostgres } from "@/backend/data/http/generate";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";
const encoder = new TextEncoder();

const sendWebhookWithRetry = async (url: string, payload: Record<string, unknown>) => {
    let attempts = 0;
    const maxAttempts = 3;
    let lastResponseContent = "";

    while (attempts < maxAttempts) {
        attempts++;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const text = await response.text();
            lastResponseContent = `${response.status} ${response.statusText}: ${text.substring(0, 500)}`;

            if (!response.ok) {
                if (attempts < maxAttempts) await new Promise(r => setTimeout(r, 10000));
            } else {
                return { attempts, response: lastResponseContent, success: true };
            }

        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            lastResponseContent = `Error: ${msg}`;
            if (attempts < maxAttempts) await new Promise(r => setTimeout(r, 10000));
        }
    }
    return { attempts, response: lastResponseContent, success: false };
};

/**
 * Generate PDF from template
 * POST /api/v1/generate
 */
export async function POST(request: NextRequest) {
    if (isPostgresBackend()) {
        return generatePostgres(request);
    }

    try {
        const auth = await getAuthenticatedDatabases(request);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { tables, user } = auth;
        const { template_id, name, data: inputData, webhook_callback } = await request.json();

        if (webhook_callback && !validateWebhookUrl(webhook_callback)) {
            return NextResponse.json({ error: "Invalid webhook_callback URL" }, { status: 400 });
        }

        if (!template_id || !name) {
            return NextResponse.json(
                { error: "template_id and name are required" },
                { status: 400 },
            );
        }

        // Get template
        const template = await tables.getRow({
            databaseId: DATABASE_ID,
            tableId: COLLECTIONS.TEMPLATES,
            rowId: template_id
        });

        if (!template) {
            return NextResponse.json({ error: "Template not found" }, { status: 404 });
        }

        if (template.user_id !== user.id) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        // Common data encoding
        const encodedData = Buffer.from(JSON.stringify(inputData || {})).toString('base64');
        const generationMode = process.env.PDF_GENERATION_MODE || "sync";

        if (generationMode === "queue") {
            // QUEUE MODE: Create document. Function will handle webhook logging.
            const download_id = ID.unique();

            await tables.createRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.DOCUMENTS,
                rowId: download_id,
                data: {
                    template_id,
                    name,
                    user_id: user.id,
                    pdf_file: "",
                    data: encodedData,
                    status: "queued",
                    size: 0,
                    downloads: 0,
                    webhook_callback: webhook_callback || null,
                    webhook_response: null,
                    webhook_retry: 0
                },
                permissions: [
                    Permission.read(Role.user(user.id)),
                    Permission.update(Role.user(user.id)),
                    Permission.delete(Role.user(user.id)),
                ]
            });

            // Invalidate document list cache and trigger UI refresh
            revalidatePath("/documents", "page");
            revalidatePath("/dashboard", "page");
            revalidateTag("documents", "max");
            revalidateTag(`user-documents-${user.id}`, "max");
            revalidateTag("dashboard", "max");
            revalidateTag(`user-dashboard-${user.id}`, "max");

            if (webhook_callback) {
                // Return immediately
                return NextResponse.json({
                    success: true,
                    status: "queued",
                    download_id: download_id,
                    message: "Document generation enqueued. You will be notified via webhook."
                });
            } else {
                // Sync wait: Polling for up to X seconds (unchanged logic for sync-wait without webhook)
                // If webhook_callback is NOT provided, client waits.
                // If webhook_callback IS provided, we returned above.

                // ...Polling Logic (omitted for brevity as it remains same, only minor webhook logic changed)...
                // Since webhook_callback logic is above, this block is for NO webhook_callback

                console.log(`[Queue-Wait] Polling status for document ${download_id}...`);
                const startTime = Date.now();
                const timeoutSeconds = parseInt(process.env.PDF_GENERATION_TIMEOUT || "30", 10);
                const timeoutMs = timeoutSeconds * 1000;

                while (Date.now() - startTime < timeoutMs) {
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    const doc = await tables.getRow({
                        databaseId: DATABASE_ID,
                        tableId: COLLECTIONS.DOCUMENTS,
                        rowId: download_id
                    });

                    if (doc.status === "completed") {
                        const signature = doc.signature;
                        return NextResponse.json({
                            success: true,
                            document: {
                                id: doc.$id,
                                name: doc.name,
                                template_id: doc.template_id,
                                size: doc.size,
                                status: doc.status,
                                signature: signature
                            },
                            download_url: `${process.env.NEXT_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_APP_URL}/api/v1/documents/${doc.$id}/download?signature=${signature}`,
                        });
                    }

                    if (doc.status === "failed") {
                        return NextResponse.json({
                            error: doc.error_message || "Document generation failed in queue"
                        }, { status: 500 });
                    }
                }

                // Timeout
                console.error(`[Queue-Wait] Timeout waiting for document ${download_id}`);
                try {
                    await tables.updateRow({
                        databaseId: DATABASE_ID,
                        tableId: COLLECTIONS.DOCUMENTS,
                        rowId: download_id,
                        data: { status: "failed", error_message: "Document generation timed out in queue" }
                    });
                } catch (dbErr) { console.error(dbErr); }

                return NextResponse.json({ error: "Document generation timed out", download_id, status: "failed" }, { status: 504 });

            }

        } else if (webhook_callback) {
            // ASYNC FLOW (sync mode but with webhook)
            // Not really "async" if we process it here, but requested behavior:
            // "el controlador antes de mandar el webhook lo registra aqui en esta tabla y luego lo procesa"

            const download_id = ID.unique();

            // 1. Create document with "queued" status
            await tables.createRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.DOCUMENTS,
                rowId: download_id,
                data: {
                    template_id,
                    name,
                    user_id: user.id,
                    pdf_file: "",
                    data: encodedData,
                    status: "queued",
                    size: 0,
                    downloads: 0,
                    webhook_callback: webhook_callback || null,
                    webhook_response: null,
                    webhook_retry: 0
                },
                permissions: [
                    Permission.read(Role.user(user.id)),
                    Permission.update(Role.user(user.id)),
                    Permission.delete(Role.user(user.id)),
                ]
            });

            // Invalidate document list cache and trigger UI refresh
            revalidatePath("/documents", "page");
            revalidatePath("/dashboard", "page");
            revalidateTag("documents", "max");
            revalidateTag(`user-documents-${user.id}`, "max");
            revalidateTag("dashboard", "max");
            revalidateTag(`user-dashboard-${user.id}`, "max");

            // 2. Trigger background generation (Sync logic wrapped in async for webhook handling)
            (async () => {
                let webhookId = null;
                try {
                    // 2a. Register Webhook in DB
                    const webhookRecord = await tables.createRow({
                        databaseId: DATABASE_ID,
                        tableId: COLLECTIONS.WEBHOOKS,
                        rowId: ID.unique(),
                        data: {
                            document_id: download_id,
                            url: webhook_callback,
                            retry: 0,
                            response: null,
                            payload: null,
                            execution_time: 0
                        }
                    });
                    webhookId = webhookRecord.$id;

                    console.log(`[Background] Starting generation for document: ${download_id}`);

                    const templateHtml = template.html || "";
                    const templateCss = template.css || "";

                    const { fileId, size } = await PDFGenerator.generateAndUploadPDF(
                        templateHtml,
                        templateCss,
                        inputData || {},
                        `${name}.pdf`,
                        {
                            orientation: template.orientation,
                            paperSize: template.paper_size,
                            margins: {
                                top: template.margin_top || "10mm",
                                right: template.margin_right || "10mm",
                                bottom: template.margin_bottom || "10mm",
                                left: template.margin_left || "10mm",
                            }
                        }
                    );

                    const secret = encoder.encode(JWT_SECRET);
                    const signature = await new SignJWT({
                        userId: user.id,
                        download_id: download_id
                    })
                        .setProtectedHeader({ alg: "HS256" })
                        .setIssuedAt()
                        .sign(secret);

                    // Update document
                    await tables.updateRow({
                        databaseId: DATABASE_ID,
                        tableId: COLLECTIONS.DOCUMENTS,
                        rowId: download_id,
                        data: {
                            pdf_file: fileId,
                            status: "completed",
                            size: size,
                            signature: signature
                        }
                    });

                    // Invalidate document list cache and trigger UI refresh
                    revalidatePath("/documents", "page");
                    revalidatePath("/dashboard", "page");
                    revalidateTag("documents", "max");
                    revalidateTag(`user-documents-${user.id}`, "max");
                    revalidateTag("dashboard", "max");
                    revalidateTag(`user-dashboard-${user.id}`, "max");

                    // 3. Process Webhook (Send it)
                    const downloadUrl = `${process.env.NEXT_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_APP_URL}/api/v1/documents/${download_id}/download?signature=${signature}`;

                    const webhookData = {
                        success: true,
                        download_id: download_id,
                        status: "completed",
                        download_url: downloadUrl,
                        name: name,
                        size: size
                    };

                    const webhookResult = await sendWebhookWithRetry(webhook_callback, webhookData);

                    // Update Webhook Record
                    await tables.updateRow({
                        databaseId: DATABASE_ID,
                        tableId: COLLECTIONS.WEBHOOKS,
                        rowId: webhookId,
                        data: {
                            retry: webhookResult.attempts,
                            response: webhookResult.response,
                            payload: JSON.stringify(webhookData),
                            execution_time: 0
                        }
                    });

                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : "Background generation failed";
                    console.error(`[Background] Generation failed for ${download_id}:`, error);

                    // Update document failed
                    try {
                        await tables.updateRow({
                            databaseId: DATABASE_ID,
                            tableId: COLLECTIONS.DOCUMENTS,
                            rowId: download_id,
                            data: { status: "failed", error_message: errorMessage }
                        });

                        // Invalidate document list cache and trigger UI refresh
                        revalidatePath("/documents", "page");
                        revalidatePath("/dashboard", "page");
                        revalidateTag("documents", "max");
                        revalidateTag(`user-documents-${user.id}`, "max");
                        revalidateTag("dashboard", "max");
                        revalidateTag(`user-dashboard-${user.id}`, "max");
                    } catch { }

                    // Process Webhook (Failure)
                    if (webhookId) {
                        const failureData = {
                            success: false,
                            download_id: download_id,
                            status: "failed",
                            error: errorMessage
                        };

                        const webhookResult = await sendWebhookWithRetry(webhook_callback, failureData);

                        await tables.updateRow({
                            databaseId: DATABASE_ID,
                            tableId: COLLECTIONS.WEBHOOKS,
                            rowId: webhookId,
                            data: {
                                retry: webhookResult.attempts,
                                response: webhookResult.response,
                                payload: JSON.stringify(failureData),
                                execution_time: 0
                            }
                        });
                    }
                }
            })();

            // 3. Respond immediately
            return NextResponse.json({
                success: true,
                status: "queued",
                download_id: download_id,
                message: "Document generation enqueued. You will be notified via webhook."
            });

        } else {
            // SYNC FLOW (Classic)
            try {
                const templateHtml = template.html || "";
                const templateCss = template.css || "";

                const { fileId, size } = await PDFGenerator.generateAndUploadPDF(
                    templateHtml,
                    templateCss,
                    inputData || {},
                    `${name}.pdf`,
                    {
                        orientation: template.orientation,
                        paperSize: template.paper_size,
                        margins: {
                            top: template.margin_top || "10mm",
                            right: template.margin_right || "10mm",
                            bottom: template.margin_bottom || "10mm",
                            left: template.margin_left || "10mm",
                        }
                    }
                );

                const download_id = ID.unique();
                const secret = encoder.encode(JWT_SECRET);
                const signature = await new SignJWT({ userId: user.id, download_id })
                    .setProtectedHeader({ alg: "HS256" })
                    .setIssuedAt()
                    .sign(secret);

                const createdDocument = await tables.createRow({
                    databaseId: DATABASE_ID,
                    tableId: COLLECTIONS.DOCUMENTS,
                    rowId: download_id,
                    data: {
                        template_id,
                        name,
                        user_id: user.id,
                        pdf_file: fileId,
                        data: encodedData,
                        status: "completed",
                        size: size,
                        signature: signature,
                        downloads: 0
                    },
                    permissions: [
                        Permission.read(Role.user(user.id)),
                        Permission.update(Role.user(user.id)),
                        Permission.delete(Role.user(user.id)),
                    ]
                });

                // Invalidate document list cache and trigger UI refresh
                revalidatePath("/documents", "page");
                revalidatePath("/dashboard", "page");
                revalidateTag("documents", "max");
                revalidateTag(`user-documents-${user.id}`, "max");
                revalidateTag("dashboard", "max");
                revalidateTag(`user-dashboard-${user.id}`, "max");

                return NextResponse.json({
                    success: true,
                    document: {
                        id: createdDocument.$id,
                        name: createdDocument.name,
                        template_id: createdDocument.template_id,
                        size: createdDocument.size,
                        status: createdDocument.status,
                        signature: signature
                    },
                    download_url: `${process.env.NEXT_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_APP_URL}/api/v1/documents/${createdDocument.$id}/download?signature=${signature}`,
                });
            } catch (pdfError: unknown) {
                const errorMessage = pdfError instanceof Error ? pdfError.message : "Failed to generate PDF";
                return NextResponse.json({ error: errorMessage }, { status: 500 });
            }
        }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
