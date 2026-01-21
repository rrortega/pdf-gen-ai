import { NextRequest, NextResponse } from "next/server";
import {
    DATABASE_ID,
    COLLECTIONS,
} from "@/lib/appwrite";
import { PDFGenerator } from "@/lib/pdf-generator";
import { ID, Permission, Role } from "node-appwrite";
import { getAuthenticatedDatabases } from "@/lib/auth";
import { SignJWT } from "jose";
import { validateWebhookUrl } from "@/lib/security";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";
const encoder = new TextEncoder();

/**
 * Generate PDF from template
 * POST /api/v1/generate
 */
export async function POST(request: NextRequest) {
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
            // QUEUE MODE: We don't generate the PDF here, we assume an external worker does it.
            const documentId = ID.unique();

            // 1. Create document with "queued" status
            await tables.createRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.DOCUMENTS,
                rowId: documentId,
                data: {
                    template_id,
                    name,
                    user_id: user.id,
                    pdf_file: "",
                    data: encodedData,
                    status: "queued",
                    size: 0,
                    downloads: 0,
                    webhook_callback: webhook_callback || null
                },
                permissions: [
                    Permission.read(Role.user(user.id)),
                    Permission.update(Role.user(user.id)),
                    Permission.delete(Role.user(user.id)),
                ]
            });

            if (webhook_callback) {
                // Async with webhook: respond immediately
                return NextResponse.json({
                    success: true,
                    status: "queued",
                    documentId: documentId,
                    message: "Document generation enqueued. You will be notified via webhook."
                });
            } else {
                // Sync wait: Polling for up to X seconds
                console.log(`[Queue-Wait] Polling status for document ${documentId}...`);
                const startTime = Date.now();
                const timeoutSeconds = parseInt(process.env.PDF_GENERATION_TIMEOUT || "30", 10);
                const timeoutMs = timeoutSeconds * 1000;

                while (Date.now() - startTime < timeoutMs) {
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Poll every 2 seconds

                    const doc = await tables.getRow({
                        databaseId: DATABASE_ID,
                        tableId: COLLECTIONS.DOCUMENTS,
                        rowId: documentId
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
                            pdfUrl: `${process.env.NEXT_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_APP_URL}/api/v1/documents/${doc.$id}/download?signature=${signature}`,
                        });
                    }

                    if (doc.status === "failed") {
                        return NextResponse.json({
                            error: doc.error_message || "Document generation failed in queue"
                        }, { status: 500 });
                    }
                }

                // Timeout
                console.error(`[Queue-Wait] Timeout waiting for document ${documentId}`);

                try {
                    await tables.updateRow({
                        databaseId: DATABASE_ID,
                        tableId: COLLECTIONS.DOCUMENTS,
                        rowId: documentId,
                        data: {
                            status: "failed",
                            error_message: "Document generation timed out in queue"
                        }
                    });
                } catch (dbErr) {
                    console.error("[Queue-Wait] Failed to update document status to failed:", dbErr);
                }

                return NextResponse.json({
                    error: "Document generation timed out in queue",
                    documentId: documentId,
                    status: "failed"
                }, { status: 504 });
            }

        } else if (webhook_callback) {
            // ASYNC FLOW (sync mode but with webhook)
            const documentId = ID.unique();

            // 1. Create document with "queued" status
            await tables.createRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.DOCUMENTS,
                rowId: documentId,
                data: {
                    template_id,
                    name,
                    user_id: user.id,
                    pdf_file: "", // Empty until generated
                    data: encodedData,
                    status: "queued",
                    size: 0,
                    downloads: 0,
                    webhook_callback: webhook_callback || null
                },
                permissions: [
                    Permission.read(Role.user(user.id)),
                    Permission.update(Role.user(user.id)),
                    Permission.delete(Role.user(user.id)),
                ]
            });

            // 2. Trigger background generation (non-blocking)
            (async () => {
                try {
                    console.log(`[Background] Starting generation for document: ${documentId}`);

                    const templateHtml = template.html || "";
                    const templateCss = template.css || "";

                    const { fileId, size } = await PDFGenerator.generateAndUploadPDF(
                        templateHtml,
                        templateCss,
                        inputData || {},
                        `${name}.pdf`,
                    );

                    // Generate JWT signature for security
                    const secret = encoder.encode(JWT_SECRET);
                    const signature = await new SignJWT({
                        userId: user.id,
                        documentId: documentId
                    })
                        .setProtectedHeader({ alg: "HS256" })
                        .setIssuedAt()
                        .sign(secret);

                    // Update document to completed
                    await tables.updateRow({
                        databaseId: DATABASE_ID,
                        tableId: COLLECTIONS.DOCUMENTS,
                        rowId: documentId,
                        data: {
                            pdf_file: fileId,
                            status: "completed",
                            size: size,
                            signature: signature
                        }
                    });

                    console.log(`[Background] Completed generation for document: ${documentId}`);

                    // 3. Notify Webhook
                    try {
                        const downloadUrl = `${process.env.NEXT_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_APP_URL}/api/v1/documents/${documentId}/download?signature=${signature}`;

                        await fetch(webhook_callback, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                success: true,
                                documentId: documentId,
                                status: "completed",
                                pdfUrl: downloadUrl,
                                name: name,
                                size: size
                            })
                        });
                        console.log(`[Background] Webhook notified: ${webhook_callback}`);
                    } catch (webhookErr) {
                        console.error("[Background] Failed to notify webhook:", webhookErr);
                    }

                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : "Background generation failed";
                    console.error(`[Background] Generation failed for ${documentId}:`, error);

                    // Update document to failed
                    try {
                        await tables.updateRow({
                            databaseId: DATABASE_ID,
                            tableId: COLLECTIONS.DOCUMENTS,
                            rowId: documentId,
                            data: {
                                status: "failed",
                                error_message: errorMessage
                            }
                        });
                    } catch (dbErr) {
                        console.error("[Background] Failed to update document status to failed:", dbErr);
                    }

                    // Notify Webhook of failure
                    try {
                        await fetch(webhook_callback, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                success: false,
                                documentId: documentId,
                                status: "failed",
                                error: errorMessage
                            })
                        });
                    } catch (webhookErr) {
                        console.error("[Background] Failed to notify webhook of error:", webhookErr);
                    }
                }
            })();

            // 3. Respond immediately
            return NextResponse.json({
                success: true,
                status: "queued",
                documentId: documentId,
                message: "Document generation enqueued. You will be notified via webhook."
            });

        } else {
            // SYNC FLOW (sync mode, no webhook)
            try {
                const templateHtml = template.html || "";
                const templateCss = template.css || "";

                const { fileId, size } = await PDFGenerator.generateAndUploadPDF(
                    templateHtml,
                    templateCss,
                    inputData || {},
                    `${name}.pdf`,
                );

                const documentId = ID.unique();
                const secret = encoder.encode(JWT_SECRET);
                const signature = await new SignJWT({ userId: user.id, documentId })
                    .setProtectedHeader({ alg: "HS256" })
                    .setIssuedAt()
                    .sign(secret);

                const createdDocument = await tables.createRow({
                    databaseId: DATABASE_ID,
                    tableId: COLLECTIONS.DOCUMENTS,
                    rowId: documentId,
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
                    pdfUrl: `${process.env.NEXT_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_APP_URL}/api/v1/documents/${createdDocument.$id}/download?signature=${signature}`,
                });
            } catch (pdfError: unknown) {
                const errorMessage = pdfError instanceof Error ? pdfError.message : "Failed to generate PDF";
                console.error("Sync PDF generation error:", pdfError);
                return NextResponse.json({ error: errorMessage }, { status: 500 });
            }
        }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Internal server error";
        console.error("Generate document error:", error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
