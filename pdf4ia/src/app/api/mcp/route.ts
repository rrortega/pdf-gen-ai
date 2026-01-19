import { NextRequest, NextResponse } from 'next/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import { getAuthenticatedDatabases, authenticateRequest } from '@/lib/auth';
import { PDFGenerator } from '@/lib/pdf-generator';
import { ID } from 'node-appwrite';
import { SignJWT } from 'jose';
import { z } from 'zod';

// Global server instance (or use a factory)
let serverInstance: McpServer | null = null;
const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";
const encoder = new TextEncoder();

function getOrCreateServer() {
    if (serverInstance) return serverInstance;

    const server = new McpServer({
        name: 'pdfgenai-mcp-server',
        version: '1.0.0',
    });

    // Define Tools
    server.tool(
        "generate_pdf",
        {
            template_id: z.string().describe('The ID of the template to use'),
            data: z.record(z.string(), z.any()).describe('Dynamic data to inject (JSON object)'),
            name: z.string().describe('Filename for the generated PDF'),
        },
        async ({ template_id, data, name }, extra) => {
            const transport = (extra as { transport?: any }).transport;
            // For now, we need to handle the case where we don't have the request directly
            // In a more robust implementation, we'd use the transport's sessionId to look up the request
            // For now, we'll try to get it from a common source if needed, or assume extra has it
            const request = (extra as { request?: NextRequest }).request;
            if (!request) throw new Error("Unauthorized: Request context missing");
            const auth = await getAuthenticatedDatabases(request);
            if (!auth) throw new Error("Unauthorized");

            const { tables, user } = auth;

            // Get template
            const template = await tables.getRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.TEMPLATES,
                rowId: template_id
            });

            if (!template) throw new Error("Template not found");
            if (template.user_id !== user.id) throw new Error("Access denied");

            const { fileId, size } = await PDFGenerator.generateAndUploadPDF(
                template.html || "",
                template.css || "",
                data || {},
                `${name}.pdf`,
            );

            const encodedData = Buffer.from(JSON.stringify(data || {})).toString('base64');
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

            const secret = encoder.encode(JWT_SECRET);
            const signature = await new SignJWT({
                userId: user.id,
                documentId: createdDocument.$id
            })
                .setProtectedHeader({ alg: "HS256" })
                .setIssuedAt()
                .sign(secret);

            await tables.updateRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.DOCUMENTS,
                rowId: createdDocument.$id,
                data: { signature }
            });

            const appUrl = process.env.NEXT_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_APP_URL;
            const downloadUrl = `${appUrl}/api/v1/documents/${createdDocument.$id}/download?signature=${signature}`;

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: true,
                        document_id: createdDocument.$id,
                        name: createdDocument.name,
                        download_url: downloadUrl
                    }, null, 2)
                }]
            };
        }
    );

    server.tool(
        "list_templates",
        {},
        async (_, extra) => {
            const request = (extra as { request?: NextRequest }).request;
            if (!request) throw new Error("Unauthorized: Request context missing");
            const auth = await getAuthenticatedDatabases(request);
            if (!auth) throw new Error("Unauthorized");

            const { tables, user } = auth;
            const response = await tables.listRows({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.TEMPLATES,
            });

            const templates = response.rows
                .filter(row => !row.user_id || row.user_id === user.id)
                .map(t => ({
                    id: t.$id,
                    title: t.title,
                    description: t.description,
                    tags: t.tags
                }));

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({ success: true, count: templates.length, templates }, null, 2)
                }]
            };
        }
    );

    serverInstance = server;
    return server;
}

// Map to store transports by sessionId, using global to persist across HMR in dev
const transports = ((global as any).mcpTransports as Map<string, any>) || new Map<string, any>();
if (process.env.NODE_ENV !== 'production') {
    (global as any).mcpTransports = transports;
}

export async function POST(request: NextRequest) {
    const user = await authenticateRequest(request);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionId = request.nextUrl.searchParams.get('sessionId');
    if (!sessionId) {
        return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const transport = transports.get(sessionId);
    if (!transport) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    try {
        const message = await request.json();
        if (transport.onmessage) {
            await transport.onmessage(message);
        }
        return new Response(null, { status: 202 });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
}

export { transports, getOrCreateServer };
