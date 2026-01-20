import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SignJWT } from "jose";
import { ID } from "node-appwrite";
import { validateHybridToken } from "@/lib/auth";
import { getAuthenticatedDatabases } from "@/lib/auth";
import { DATABASE_ID, COLLECTIONS } from "@/lib/appwrite";
import { PDFGenerator } from "@/lib/pdf-generator";

// Global server instance
let serverInstance: McpServer | null = null;
const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";
const encoder = new TextEncoder();

// Global transports map (persists across HMR)
const transports = ((global as any).mcpTransports as Map<string, SSEServerTransport>) || new Map<string, SSEServerTransport>();
if (!(global as any).mcpTransports) {
    (global as any).mcpTransports = transports;
}

function getOrCreateServer() {
    if (serverInstance) return serverInstance;

    const server = new McpServer({
        name: 'PDF GenAI-MCP',
        version: '1.0.0',
    });

    // Tool: generate_pdf
    server.tool(
        "generate_pdf",
        {
            template_id: z.string().describe('The ID of the template to use'),
            data: z.record(z.string(), z.any()).describe('Dynamic data to inject (JSON object)'),
            name: z.string().describe('Filename for the generated PDF'),
        },
        async ({ template_id, data, name }, extra) => {
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

    // Tool: list_templates
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

/**
 * GET: SSE Handshake
 * Establishes the Server-Sent Events connection
 */
export async function GET(request: NextRequest) {
    const start = Date.now();
    console.log('[MCP] SSE connection attempt');

    try {
        // Validate authentication
        const authHeader = request.headers.get("Authorization");
        const isValid = await validateHybridToken(authHeader);

        if (!isValid) {
            console.warn('[MCP] Unauthorized SSE attempt');
            return new NextResponse("Unauthorized", { status: 401 });
        }

        console.log(`[MCP] Auth validated in ${Date.now() - start}ms`);

        const server = getOrCreateServer();

        // Create TransformStream for SSE
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();

        // Mock response for SSEServerTransport
        const resMock = {
            statusCode: 200,
            setHeader: () => resMock,
            getHeader: () => undefined,
            removeHeader: () => resMock,
            writeHead: () => resMock,
            write: (chunk: unknown, _encoding?: string, callback?: () => void) => {
                if (typeof callback === 'function') callback();
                const data = typeof chunk === 'string' ? encoder.encode(chunk) : (chunk as Uint8Array);
                writer.write(data).catch(err => console.error('[MCP] Writer error:', err));
                return true;
            },
            end: (chunk?: unknown, _encoding?: string, callback?: () => void) => {
                if (chunk) {
                    const data = typeof chunk === 'string' ? encoder.encode(chunk) : (chunk as Uint8Array);
                    writer.write(data).catch(err => console.error('[MCP] Writer error in end:', err));
                }
                if (typeof callback === 'function') callback();
                try {
                    writer.close().catch(() => { });
                } catch {
                    // Already closed
                }
                return resMock;
            },
            on: () => resMock,
            once: () => resMock,
            emit: () => true,
            removeListener: () => resMock,
            addListener: () => resMock,
        };

        const transport = new SSEServerTransport('/api/llm/mcp', resMock as any);
        const sessionId = (transport as any).sessionId;

        if (!sessionId) {
            throw new Error("Failed to generate sessionId");
        }

        transports.set(sessionId, transport);
        (transport as any).request = request;

        await server.connect(transport);

        console.log(`[MCP] SSE connected in ${Date.now() - start}ms. Session: ${sessionId}`);

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
            },
        });
    } catch (error) {
        console.error('[MCP] SSE Error:', error);
        return new NextResponse((error as Error).message, { status: 500 });
    }
}

/**
 * POST: Message Processing
 * Handles MCP protocol messages
 */
export async function POST(request: NextRequest) {
    try {
        // Validate authentication
        const authHeader = request.headers.get("Authorization");
        const isValid = await validateHybridToken(authHeader);

        if (!isValid) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const sessionId = searchParams.get('sessionId');

        if (!sessionId) {
            return new NextResponse("Missing sessionId", { status: 400 });
        }

        const transport = transports.get(sessionId);
        if (!transport) {
            return new NextResponse("Invalid session", { status: 404 });
        }

        // Attach request for tool context
        (transport as any).request = request;

        const message = await request.json();
        await (transport as any).onmessage?.(message);

        return new NextResponse("OK", { status: 200 });
    } catch (error) {
        console.error('[MCP] POST Error:', error);
        return new NextResponse((error as Error).message, { status: 500 });
    }
}
