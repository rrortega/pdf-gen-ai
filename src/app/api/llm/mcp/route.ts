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
import { Query } from "node-appwrite";

// Environment constants
const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";
const encoder = new TextEncoder();

// Global server instance and transports map (persists across HMR)
const transports = ((global as any).mcpTransports as Map<string, SSEServerTransport>) || new Map<string, SSEServerTransport>();
if (!(global as any).mcpTransports) {
    (global as any).mcpTransports = transports;
}

// Debug logging helper
const isDebug = process.env.MCP_DEBUG === "true";
function debugLog(message: string, data?: any) {
    if (isDebug) {
        console.log(`[MCP_DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
}

/**
 * Singleton getter for the MCP Server instance
 */
function getOrCreateServer() {
    if ((global as any).mcpServerInstance) return (global as any).mcpServerInstance;

    const server = new McpServer({
        name: 'PDF GenAI-MCP',
        version: '1.0.0',
    });

    // Tool: generate_pdf
    server.tool(
        "generate_pdf",
        {
            template_id: z.string().describe('The ID of the template to use'),
            data: z.record(z.string(), z.any()).describe('Dynamic data to inject (JSON object) in response to the template schema of the test_data attribute'),
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

    // Tool: list_pdf_templates
    server.tool(
        "list_pdf_templates",
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
                queries: [Query.equal("user_id", user.id)]
            });

            const templates = response.rows
                .map(t => ({
                    id: t.$id,
                    title: t.title,
                    test_data: Buffer.from(t.test_data, 'base64').toString('utf8'),
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

    (global as any).mcpServerInstance = server;
    return server;
}

/**
 * GET: SSE Handshake
 */
export async function GET(request: NextRequest) {
    debugLog('SSE handshake attempt starting');

    // 1. Auth Check (Wait for it, it's fast)
    const authHeader = request.headers.get("Authorization");
    const isValid = await validateHybridToken(authHeader);

    if (!isValid) {
        console.warn('[MCP] Unauthorized SSE attempt');
        return new NextResponse("Unauthorized", { status: 401 });
    }

    // 2. Setup Stream
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // 3. Create Transport to get Session ID
    const resMock = {
        statusCode: 200,
        setHeader: () => resMock,
        getHeader: () => undefined,
        removeHeader: () => resMock,
        writeHead: () => resMock,
        write: (chunk: any) => {
            const data = typeof chunk === 'string' ? encoder.encode(chunk) : chunk;
            writer.write(data).catch(() => { });
            return true;
        },
        end: (chunk?: any) => {
            if (chunk) {
                const data = typeof chunk === 'string' ? encoder.encode(chunk) : chunk;
                writer.write(data).catch(() => { });
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
        return new NextResponse("Failed to generate session", { status: 500 });
    }

    // Persist and setup background tasks
    transports.set(sessionId, transport);
    (transport as any).request = request;

    (async () => {
        try {
            const server = getOrCreateServer();
            await server.connect(transport);

            // Initial flush
            await writer.write(encoder.encode(': mcp-initial-flush\n\n'));

            // Heartbeat
            const keepAlive = setInterval(() => {
                writer.write(encoder.encode(': heartbeat\n\n')).catch(() => clearInterval(keepAlive));
            }, 15000);

            request.signal.addEventListener('abort', () => {
                clearInterval(keepAlive);
                transports.delete(sessionId);
                writer.close().catch(() => { });
            });

        } catch (error) {
            console.error('[MCP] SSE Stream Error:', error);
            try { await writer.close(); } catch { }
        }
    })();

    // 4. Return Response WITH required header
    return new Response(readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            'Access-Control-Allow-Origin': '*',
            'mcp-session-id': sessionId,
            'X-MCP-Session-Id': sessionId, // Some clients use this variant
        },
    });
}

/**
 * POST: Message Processing (Stateful & Stateless)
 */
export async function POST(request: NextRequest) {
    const postStart = Date.now();
    try {
        const authHeader = request.headers.get("Authorization");
        const isValid = await validateHybridToken(authHeader);

        if (!isValid) {
            return new NextResponse("Unauthorized", { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        const message = await request.json();
        const searchParams = request.nextUrl.searchParams;
        const sessionId = searchParams.get('sessionId');

        debugLog('Incoming POST Body:', message);
        debugLog('Query Parameters:', Object.fromEntries(searchParams.entries()));

        // CASE A: Stateless POST (Wait for individual tool response)
        if (!sessionId) {
            debugLog('Handling stateless POST request');
            const server = getOrCreateServer();

            const response = await new Promise<any>((resolve) => {
                const timeout = setTimeout(() => {
                    resolve({
                        jsonrpc: "2.0",
                        id: message.id || null,
                        error: { code: -32000, message: "MCP Server response timeout (10s)" }
                    });
                }, 10000);

                const transport = {
                    onclose: undefined,
                    onmessage: undefined,
                    send: async (msg: any) => {
                        clearTimeout(timeout);
                        resolve(msg);
                    },
                    close: async () => { },
                    start: async () => { }
                };

                server.connect(transport as any).then(() => {
                    (transport as any).onmessage?.(message, { request });
                }).catch((err: any) => {
                    clearTimeout(timeout);
                    resolve({ jsonrpc: "2.0", id: message.id || null, error: { code: -32603, message: err.message } });
                });
            });

            console.log(`[MCP] Stateless POST fulfilled in ${Date.now() - postStart}ms`);
            return new Response(JSON.stringify(response), {
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        // CASE B: Stateful POST
        const transport = transports.get(sessionId);
        if (!transport) {
            return new NextResponse(`Session ${sessionId} not found`, { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        (transport as any).request = request;
        if ((transport as any).onmessage) {
            await (transport as any).onmessage(message, { request });
        }

        return new Response("OK", { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });

    } catch (error) {
        console.error('[MCP] POST Error:', error);
        return new NextResponse((error as Error).message, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
}
