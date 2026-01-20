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

// Global server instance
let serverInstance: McpServer | null = null;
const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";
const encoder = new TextEncoder();

// Global transports map (persists across HMR)
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

    // Tool: list_templates
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

    serverInstance = server;
    return server;
}

/**
 * GET: SSE Handshake
 * Establishes the Server-Sent Events connection
 */
export async function GET(request: NextRequest) {
    const start = Date.now();
    console.log('[MCP] SSE handshake attempt starting');

    // Log headers if debug is on
    const headers: Record<string, string> = {};
    request.headers.forEach((v, k) => { headers[k] = v; });
    debugLog('Incoming SSE Headers:', headers);

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // BACKGROUND TASK: Handle authentication and handshake logic
    // We do this to return the Response object immediately and prevent timeouts
    (async () => {
        try {
            // 1. Validate authentication (from the original request headers)
            const authHeader = request.headers.get("Authorization");
            const isValid = await validateHybridToken(authHeader);

            if (!isValid) {
                console.warn('[MCP] Unauthorized SSE attempt');
                await writer.write(encoder.encode('event: error\ndata: Unauthorized\n\n'));
                await writer.close();
                return;
            }

            console.log(`[MCP] Auth validated in ${Date.now() - start}ms`);

            // 2. Initialize MCP Server instance
            const server = getOrCreateServer();

            // 3. Setup SSEServerTransport mock with the direct stream writer
            const resMock = {
                statusCode: 200,
                setHeader: () => resMock,
                getHeader: () => undefined,
                removeHeader: () => resMock,
                writeHead: () => resMock,
                write: (chunk: unknown, _encoding?: string, callback?: () => void) => {
                    if (typeof callback === 'function') callback();
                    const data = typeof chunk === 'string' ? encoder.encode(chunk) : (chunk as Uint8Array);
                    writer.write(data).catch(err => console.error('[MCP] Writer write error:', err));
                    return true;
                },
                end: (chunk?: unknown, _encoding?: string, callback?: () => void) => {
                    if (chunk) {
                        const data = typeof chunk === 'string' ? encoder.encode(chunk) : (chunk as Uint8Array);
                        writer.write(data).catch(err => console.error('[MCP] Writer end error:', err));
                    }
                    if (typeof callback === 'function') callback();
                    // Do NOT close writer here, let transport or signal handle it
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

            // 4. Connect server to transport
            await server.connect(transport);
            console.log(`[MCP] SSE session ${sessionId} connected in ${Date.now() - start}ms`);

            // 5. Initial flush to unblock proxies (comment)
            await writer.write(encoder.encode(': mcp-initial-flush\n\n'));

            // 6. Keep-alive heartbeat every 15s
            const keepAliveInterval = setInterval(() => {
                writer.write(encoder.encode(': heartbeat\n\n')).catch(() => {
                    clearInterval(keepAliveInterval);
                });
            }, 15000);

            // Cleanup when connection closes
            request.signal.addEventListener('abort', () => {
                console.log(`[MCP] SSE session ${sessionId} aborted`);
                clearInterval(keepAliveInterval);
                transports.delete(sessionId);
                try {
                    writer.close().catch(() => { });
                } catch { /* already closed */ }
            });

        } catch (error) {
            console.error('[MCP] SSE Handshake Background Error:', error);
            try {
                await writer.write(encoder.encode(`event: error\ndata: ${(error as Error).message}\n\n`));
                await writer.close();
            } catch { /* ignore */ }
        }
    })();

    // RETURN RESPONSE IMMEDIATELY
    return new Response(readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            'Access-Control-Allow-Origin': '*',
        },
    });
}

/**
 * POST: Message Processing
 * Handles MCP protocol messages (both stateful with sessionId and stateless)
 */
export async function POST(request: NextRequest) {
    const postStart = Date.now();
    try {
        // 1. Validate authentication
        const authHeader = request.headers.get("Authorization");
        const isValid = await validateHybridToken(authHeader);

        if (!isValid) {
            return new NextResponse("Unauthorized", {
                status: 401,
                headers: { 'Access-Control-Allow-Origin': '*' }
            });
        }

        const message = await request.json();
        const searchParams = request.nextUrl.searchParams;
        const sessionId = searchParams.get('sessionId');

        debugLog('Incoming POST Body:', message);
        debugLog('Query Parameters:', Object.fromEntries(searchParams.entries()));

        // CASE A: Stateless POST (No sessionId)
        // Useful for one-off tool calls from non-SSE clients (e.g., standard agent scripts)
        if (!sessionId) {
            console.log('[MCP] Handling stateless POST request');
            const server = getOrCreateServer();

            let responseMessage: any = null;
            // Simple bridge transport that captures a single response
            const transport = {
                onclose: undefined,
                onmessage: undefined,
                send: async (msg: any) => { responseMessage = msg; },
                close: async () => { },
                start: async () => { }
            };

            // Connect, process, and return result
            await server.connect(transport as any);
            if ((transport as any).onmessage) {
                await (transport as any).onmessage(message);
            }

            if (responseMessage) {
                console.log(`[MCP] Stateless POST fulfilled in ${Date.now() - postStart}ms`);
                return new Response(JSON.stringify(responseMessage), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            }

            return new Response("OK", {
                status: 200,
                headers: { 'Access-Control-Allow-Origin': '*' }
            });
        }

        // CASE B: Stateful POST (With sessionId)
        // Standard MCP SSE protocol
        const transport = transports.get(sessionId);
        if (!transport) {
            console.warn(`[MCP] POST attempt with invalid sessionId: ${sessionId}`);
            return new NextResponse(`Invalid or expired session: ${sessionId}. Please reconnect via SSE.`, {
                status: 404,
                headers: { 'Access-Control-Allow-Origin': '*' }
            });
        }

        // Attach request for tool context
        (transport as any).request = request;
        await (transport as any).onmessage?.(message);

        console.log(`[MCP] Stateful POST message processed for ${sessionId} in ${Date.now() - postStart}ms`);
        return new Response("OK", {
            status: 200,
            headers: { 'Access-Control-Allow-Origin': '*' }
        });
    } catch (error) {
        console.error('[MCP] POST Error:', error);
        return new Response((error as Error).message, {
            status: 500,
            headers: { 'Access-Control-Allow-Origin': '*' }
        });
    }
}
