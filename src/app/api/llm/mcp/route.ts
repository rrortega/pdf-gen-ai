import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { SignJWT } from "jose";
import { ID, Query } from "node-appwrite";
import { validateHybridToken, getAuthenticatedDatabases } from "@/lib/auth";
import { DATABASE_ID, COLLECTIONS } from "@/lib/appwrite";
import { PDFGenerator } from "@/lib/pdf-generator";
import { McpInputError, readMcpRequest } from "@/lib/mcp-input";
import { McpSessionStore } from "@/lib/mcp-session";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";
const encoder = new TextEncoder();
const isDebug = process.env.MCP_DEBUG === "true";

type StatefulTransport = {
    onmessage?: (message: unknown, extra?: { request: NextRequest }) => Promise<void> | void;
    close: () => Promise<void>;
};

type ManagedSession = {
    transport: StatefulTransport;
    setRequest: (request: NextRequest) => void;
    close: () => Promise<void>;
};

const sessions = ((global as typeof globalThis & { mcpSessions?: McpSessionStore<ManagedSession> }).mcpSessions
    ?? new McpSessionStore<ManagedSession>());
(global as typeof globalThis & { mcpSessions?: McpSessionStore<ManagedSession> }).mcpSessions = sessions;

function debugLog(message: string, data?: unknown) {
    if (isDebug) {
        console.log(`[MCP_DEBUG] ${message}`, data === undefined ? "" : JSON.stringify(data, null, 2));
    }
}

function createMcpServer(getRequest: () => NextRequest | undefined) {
    const server = new McpServer({ name: "PDF GenAI-MCP", version: "1.0.0" });

    server.tool(
        "generate_pdf",
        {
            template_id: z.string().describe("The ID of the template to use"),
            data: z.record(z.string(), z.any()).describe("Dynamic data to inject (JSON object) in response to the template schema of the test_data attribute"),
            name: z.string().describe("Filename for the generated PDF"),
        },
        async ({ template_id, data, name }) => {
            const request = getRequest();
            if (!request) throw new Error("Unauthorized: Request context missing");

            const auth = await getAuthenticatedDatabases(request);
            if (!auth) throw new Error("Unauthorized");

            const { tables, user } = auth;
            const template = await tables.getRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.TEMPLATES,
                rowId: template_id,
            });

            if (!template) throw new Error("Template not found");
            if (template.user_id !== user.id) throw new Error("Access denied");

            const { fileId, size } = await PDFGenerator.generateAndUploadPDF(
                template.html || "",
                template.css || "",
                data || {},
                `${name}.pdf`,
            );

            const encodedData = Buffer.from(JSON.stringify(data || {})).toString("base64");
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
                    size,
                    downloads: 0,
                },
            });

            const signature = await new SignJWT({ userId: user.id, download_id: createdDocument.$id })
                .setProtectedHeader({ alg: "HS256" })
                .setIssuedAt()
                .sign(encoder.encode(JWT_SECRET));

            await tables.updateRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.DOCUMENTS,
                rowId: createdDocument.$id,
                data: { signature },
            });

            revalidatePath("/documents", "page");
            revalidatePath("/dashboard", "page");
            revalidateTag("documents", "max");
            revalidateTag(`user-documents-${user.id}`, "max");
            revalidateTag("dashboard", "max");
            revalidateTag(`user-dashboard-${user.id}`, "max");

            const appUrl = process.env.NEXT_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_APP_URL;
            const downloadUrl = `${appUrl}/api/v1/documents/${createdDocument.$id}/download?signature=${signature}`;
            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        success: true,
                        document_id: createdDocument.$id,
                        name: createdDocument.name,
                        download_url: downloadUrl,
                    }, null, 2),
                }],
            };
        },
    );

    server.tool("list_pdf_templates", {}, async () => {
        const request = getRequest();
        if (!request) throw new Error("Unauthorized: Request context missing");

        const auth = await getAuthenticatedDatabases(request);
        if (!auth) throw new Error("Unauthorized");

        const { tables, user } = auth;
        const response = await tables.listRows({
            databaseId: DATABASE_ID,
            tableId: COLLECTIONS.TEMPLATES,
            queries: [Query.equal("user_id", user.id)],
        });
        const templates = response.rows.map((template) => ({
            id: template.$id,
            title: template.title,
            test_data: Buffer.from(template.test_data, "base64").toString("utf8"),
            tags: template.tags,
        }));

        return {
            content: [{ type: "text" as const, text: JSON.stringify({ success: true, count: templates.length, templates }, null, 2) }],
        };
    });

    return server;
}

function corsHeaders() {
    return { "Access-Control-Allow-Origin": "*" };
}

async function authorize(request: NextRequest): Promise<string | undefined> {
    const authorization = request.headers.get("Authorization");
    return authorization && await validateHybridToken(authorization) ? authorization : undefined;
}

export async function GET(request: NextRequest) {
    debugLog("SSE handshake attempt starting");
    const owner = await authorize(request);
    if (!owner) return new NextResponse("Unauthorized", { status: 401 });

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const responseMock = {
        statusCode: 200,
        setHeader: () => responseMock,
        getHeader: () => undefined,
        removeHeader: () => responseMock,
        writeHead: () => responseMock,
        write: (chunk: string | Uint8Array) => {
            writer.write(typeof chunk === "string" ? encoder.encode(chunk) : chunk).catch(() => undefined);
            return true;
        },
        end: (chunk?: string | Uint8Array) => {
            if (chunk) responseMock.write(chunk);
            return responseMock;
        },
        on: () => responseMock,
        once: () => responseMock,
        emit: () => true,
        removeListener: () => responseMock,
        addListener: () => responseMock,
    };
    const transport = new SSEServerTransport("/api/llm/mcp", responseMock as never);
    const sessionId = (transport as unknown as { sessionId?: string }).sessionId;
    if (!sessionId) return new NextResponse("Failed to generate session", { status: 500 });

    let activeRequest: NextRequest | undefined = request;
    const server = createMcpServer(() => activeRequest);
    let cleaned = false;
    let keepAlive: ReturnType<typeof setInterval> | undefined;
    const cleanup = async () => {
        if (cleaned) return;
        cleaned = true;
        if (keepAlive) clearInterval(keepAlive);
        activeRequest = undefined;
        await sessions.close(sessionId, owner);
        await writer.close().catch(() => undefined);
    };

    sessions.add(sessionId, owner, {
        transport: transport as unknown as StatefulTransport,
        setRequest: (nextRequest) => { activeRequest = nextRequest; },
        close: async () => {
            await Promise.allSettled([server.close(), transport.close()]);
        },
    });
    transport.onclose = () => { void cleanup(); };
    request.signal.addEventListener("abort", () => { void cleanup(); }, { once: true });

    try {
        await server.connect(transport);
        await writer.write(encoder.encode(": mcp-initial-flush\n\n"));
        keepAlive = setInterval(() => {
            writer.write(encoder.encode(": heartbeat\n\n")).catch(() => { void cleanup(); });
        }, 15_000);
    } catch (error) {
        console.error("[MCP] SSE Stream Error:", error);
        await cleanup();
        return new NextResponse("Failed to start MCP session", { status: 500 });
    }

    return new Response(readable, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
            ...corsHeaders(),
            "mcp-session-id": sessionId,
            "X-MCP-Session-Id": sessionId,
        },
    });
}

export async function POST(request: NextRequest) {
    const owner = await authorize(request);
    if (!owner) return new NextResponse("Unauthorized", { status: 401, headers: corsHeaders() });

    try {
        const message = await readMcpRequest(request);
        const sessionId = request.nextUrl.searchParams.get("sessionId");
        debugLog("Incoming POST Body", message);

        if (sessionId) {
            const session = sessions.get(sessionId, owner);
            if (!session) return new NextResponse(`Session ${sessionId} not found`, { status: 404, headers: corsHeaders() });

            session.resource.setRequest(request);
            request.signal.addEventListener("abort", () => { void sessions.close(sessionId, owner); }, { once: true });
            const transport = session.resource.transport;
            try {
                if (transport.onmessage) await transport.onmessage(message, { request });
            } catch (error) {
                await sessions.close(sessionId, owner);
                throw error;
            }
            return new Response("OK", { status: 200, headers: corsHeaders() });
        }

        let activeRequest: NextRequest | undefined = request;
        const server = createMcpServer(() => activeRequest);
        let resolveResponse: (message: unknown) => void = () => undefined;
        const response = new Promise<unknown>((resolve) => { resolveResponse = resolve; });
        const transport = {
            onclose: undefined,
            onmessage: undefined as ((message: unknown, extra?: { request: NextRequest }) => Promise<void> | void) | undefined,
            send: async (outgoing: unknown) => resolveResponse(outgoing),
            close: async () => undefined,
            start: async () => undefined,
        };

        try {
            await server.connect(transport as never);
            if (!transport.onmessage) throw new Error("MCP transport did not initialize");
            await transport.onmessage(message, { request });
            const result = await Promise.race([
                response,
                new Promise((resolve) => setTimeout(() => resolve({
                    jsonrpc: "2.0", id: (message as { id?: unknown }).id ?? null,
                    error: { code: -32000, message: "MCP Server response timeout (10s)" },
                }), 10_000)),
            ]);
            return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json", ...corsHeaders() } });
        } finally {
            activeRequest = undefined;
            await Promise.allSettled([server.close(), transport.close()]);
        }
    } catch (error) {
        if (error instanceof McpInputError) {
            return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders() });
        }
        console.error("[MCP] POST Error:", error);
        return new NextResponse(error instanceof Error ? error.message : "MCP request failed", { status: 500, headers: corsHeaders() });
    }
}
