import { NextRequest, NextResponse } from 'next/server';
import { requireOAuth } from '@/lib/oauth-middleware';
import { generatePDF } from '@/lib/pdf-generator';
import { getServerAppwriteTables, DATABASE_ID } from '@/lib/appwrite';
import { ID } from 'node-appwrite';

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

        let userId: string;

        if ('error' in oauthResult) {
            // OAuth failed, try API key authentication
            const apiKey = request.headers.get('x-api-key');

            if (!apiKey) {
                return NextResponse.json(
                    { error: 'Authentication required. Provide either OAuth token or API key.' },
                    { status: 401 }
                );
            }

            // Verify API key and get user ID
            const tables = getServerAppwriteTables();
            const apiKeyDocs = await tables.listDocuments(
                DATABASE_ID,
                'api_keys',
                [{ method: 'equal', attribute: 'key', values: [apiKey] }]
            );

            if (apiKeyDocs.documents.length === 0) {
                return NextResponse.json(
                    { error: 'Invalid API key' },
                    { status: 401 }
                );
            }

            userId = apiKeyDocs.documents[0].user_id;
        } else {
            // OAuth authentication successful
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

        // Get template
        const tables = getServerAppwriteTables();
        const template = await tables.getDocument(
            DATABASE_ID,
            'templates',
            template_id
        );

        if (!template) {
            return NextResponse.json(
                { error: 'Template not found' },
                { status: 404 }
            );
        }

        // Generate PDF
        const pdfBuffer = await generatePDF(template.html_content, data);

        // Save to storage and create document record
        const storage = await import('@/lib/appwrite').then(m => m.getServerAppwriteStorage());
        const pdfFilename = filename || `document-${Date.now()}.pdf`;

        const file = await storage.createFile(
            'pdfs',
            ID.unique(),
            new File([pdfBuffer], pdfFilename, { type: 'application/pdf' })
        );

        // Create document record
        const document = await tables.createDocument(
            DATABASE_ID,
            'documents',
            ID.unique(),
            {
                user_id: userId,
                template_id,
                filename: pdfFilename,
                file_id: file.$id,
                size: pdfBuffer.length,
                created_at: new Date().toISOString(),
            }
        );

        // Generate download URL
        const downloadUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/v1/documents/${document.$id}/download`;

        return NextResponse.json({
            success: true,
            document_id: document.$id,
            filename: pdfFilename,
            download_url: downloadUrl,
            created_at: document.created_at,
        });

    } catch (error: any) {
        console.error('PDF generation error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to generate PDF' },
            { status: 500 }
        );
    }
}
