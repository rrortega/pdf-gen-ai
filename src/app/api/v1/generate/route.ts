import { NextRequest, NextResponse } from "next/server";
import {
    DATABASE_ID,
    COLLECTIONS,
} from "@/lib/appwrite";
import { PDFGenerator } from "@/lib/pdf-generator";
import { ID } from "node-appwrite";
import { getAuthenticatedDatabases } from "@/lib/auth";
import { SignJWT } from "jose";


const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";
const encoder = new TextEncoder();
/**
 * Generate PDF from template
 * POST /api/v1/generate
 * 
 * Supports both OAuth tokens and API keys (via getAuthenticatedDatabases)
 */
export async function POST(request: NextRequest) {
    try {
        const auth = await getAuthenticatedDatabases(request);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { tables, user } = auth;

        const { template_id, name, data, webhook_callback } = await request.json();

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

        // Check if template belongs to current user
        if (template.user_id !== user.id) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        // Generate PDF (sync mode)
        try {
            const templateHtml = template.html || "";
            const templateCss = template.css || "";

            if (!templateHtml) {
                console.error("Template HTML is missing for template:", template_id, "Fields found:", Object.keys(template));
                throw new Error("Template HTML is missing");
            }

            console.log("Generating PDF for template:", template_id);

            const { fileId, size } = await PDFGenerator.generateAndUploadPDF(
                templateHtml,
                templateCss,
                data || {},
                `${name}.pdf`,
            );

            // Encode data to base64
            const encodedData = Buffer.from(JSON.stringify(data || {})).toString('base64');


            // Create document record
            const createdDocument = await tables.createRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.DOCUMENTS,
                rowId: ID.unique(),
                data: {
                    template_id,
                    name,
                    user_id: user.id,
                    pdf_file: fileId,
                    data: encodedData,
                    status: "completed",
                    size: size,
                    downloads: 0
                }
            });

            // Decode for response
            const responseDocument = { ...createdDocument };
            try {
                const decoded = Buffer.from(createdDocument.data, 'base64').toString('utf8');
                responseDocument.data = JSON.parse(decoded);
            } catch (e) {
                console.warn("Could not decode data for response:", e);
            }

            // Generate new JWT
            const secret = encoder.encode(JWT_SECRET);
            const signature = await new SignJWT({
                userId: user.id,
                documentId: responseDocument.$id
            })
                .setProtectedHeader({ alg: "HS256" })
                .setIssuedAt()
                .sign(secret);

            await tables.updateRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.DOCUMENTS,
                rowId: responseDocument.$id,
                data: {
                    signature: signature
                }
            });

            // Webhook support logic (Simulated here for now)
            if (webhook_callback) {
                // In a real prod environment, this would be a background task
                setTimeout(async () => {
                    console.log(`Sending webhook to ${webhook_callback} for document ${createdDocument.$id}`);
                    // POST payload with document ID and signature...
                }, 100);
                return NextResponse.json({
                    success: true,
                    message: "Document generation started, webhook will be notified.",
                    documentId: createdDocument.$id,
                });
            }

            return NextResponse.json({
                success: true,
                document: {
                    id: responseDocument.$id,
                    name: responseDocument.name,
                    template_id: responseDocument.template_id,
                    size: responseDocument.size,
                    status: responseDocument.status,
                    error_message: responseDocument.error_message,
                    signature: signature
                },
                pdfUrl: `${process.env.NEXT_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_APP_URL}/api/v1/documents/${responseDocument.$id}/download?signature=${signature}`,
            });
        } catch (pdfError: unknown) {
            const errorMessage = pdfError instanceof Error ? pdfError.message : "PDF generation failed";
            console.error("PDF generation error:", pdfError);

            // Encode data for failed document
            const encodedData = Buffer.from(JSON.stringify(data || {})).toString('base64');

            // Create document with failed status
            const failedDocument = await tables.createRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.DOCUMENTS,
                rowId: ID.unique(),
                data: {
                    template_id,
                    name,
                    user_id: user.id,
                    pdf_file: "",
                    data: encodedData,
                    status: "failed",
                    error_message: errorMessage
                }
            });

            return NextResponse.json(
                {
                    error: "Failed to generate PDF",
                    document: {
                        id: failedDocument.$id,
                        name: failedDocument.name,
                        template_id: failedDocument.template_id,
                        size: failedDocument.size,
                        status: failedDocument.status,
                        error_message: failedDocument.error_message,
                    }
                },
                { status: 500 },
            );
        }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to generate document";
        console.error("Generate document error:", error);
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 },
        );
    }
}
