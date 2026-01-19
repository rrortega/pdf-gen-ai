import { NextRequest, NextResponse } from 'next/server';
import { requireOAuth } from '@/lib/oauth-middleware';
import { PDFGenerator } from '@/lib/pdf-generator';
import { DATABASE_ID, BUCKETS, getServerAppwriteStorage, getServerAppwriteTables } from '@/lib/appwrite';
import { getAuthenticatedDatabases } from '@/lib/auth';
import { ID } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import { COLLECTIONS } from '@/lib/appwrite';

/**
 * Generate PDF from template
 * POST /api/v1/generate
 * 
 * Supports both OAuth tokens and API keys
 */
export async function POST(request: NextRequest) {
    try {
        // Try OAuth authentication first
        const oauthResult = await requireOAuth(request, ['documents:write']);

        let tables: any;
        let userId: string;

        if ('error' in oauthResult) {
            // OAuth failed, try helper that supports Session and API Key
            const auth = await getAuthenticatedDatabases(request);
            if (!auth) {
                return oauthResult.error;
            }
            // Use authenticated TablesDB instance
            tables = auth.tables;
            userId = auth.user.id;
        } else {
            // OAuth successful
            tables = getServerAppwriteTables();
            userId = oauthResult.context.userId;
        }

        // Parse request body
        const body = await request.json();
        const { template_id, data, filename } = body;

        if (!template_id || !data) {
            return NextResponse.json(
                { error: 'Missing required fields: template_id, data' },
                { status: 400 }
            );
        }

        // Get template using Tables API
        const template = await tables.getRow({
            databaseId: DATABASE_ID,
            tableId: COLLECTIONS.TEMPLATES,
            rowId: template_id
        });

        if (!template) {
            return NextResponse.json(
                { error: 'Template not found' },
                { status: 404 }
            );
        }

        // Generate PDF
        const pdfBuffer = await PDFGenerator.generatePDF(
            template.html || '',
            template.css || '',
            data,
            {
                orientation: template.orientation as "portrait" | "landscape",
                paperSize: template.paper_size,
                margins: {
                    top: template.margin_top,
                    right: template.margin_right,
                    bottom: template.margin_bottom,
                    left: template.margin_left,
                },
            }
        );

        // Save to storage and create document record
        const storage = getServerAppwriteStorage();
        const pdfFilename = filename || `document-${Date.now()}.pdf`;

        const file = await storage.createFile(
            BUCKETS.PDFS,
            ID.unique(),
            InputFile.fromBuffer(pdfBuffer, pdfFilename)
        );

        // Create document record using Tables API
        const document = await tables.createRow({
            databaseId: DATABASE_ID,
            tableId: COLLECTIONS.DOCUMENTS,
            rowId: ID.unique(),
            data: {
                user_id: userId,
                template_id,
                filename: pdfFilename,
                file_id: file.$id,
                size: pdfBuffer.length,
                created_at: new Date().toISOString(),
            }
        });

        // Generate download URL
        const downloadUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/v1/documents/${document.$id}/download`;

        return NextResponse.json({
            success: true,
            document_id: document.$id,
            filename: pdfFilename,
            download_url: downloadUrl,
            created_at: document.created_at || document.$createdAt,
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate PDF';
        console.error('PDF generation error:', error);
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
