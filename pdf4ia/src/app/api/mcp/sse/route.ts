import { NextRequest } from 'next/server';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { getOrCreateServer, transports } from '../route';

/**
 * MCP SSE Initialization Endpoint
 * This route sets up the persistent SSE connection for ChatGPT and other remote clients.
 */
export async function GET(request: NextRequest) {
    const server = getOrCreateServer();

    // In Next.js App Router, we use TransformStream to create an SSE response
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const sessionId = Math.random().toString(36).substring(7);

    const nextTransport = new SSEServerTransport('/api/mcp', {
        write: async (message: unknown) => {
            await writer.write(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
        },
        end: async () => {
            try {
                await writer.close();
            } catch {
                // Ignore if already closed
            }
            transports.delete(sessionId);
        }
    } as any);

    // Attach sessionId for later retrieval in tools
    (nextTransport as any).sessionId = sessionId;

    transports.set(sessionId, nextTransport);

    // Provide the request context to tools
    // In latest SDK, connect only takes the transport
    await server.connect(nextTransport);

    // Send the endpoint URL to the client as per MCP spec
    // Note: SSEServerTransport usually handles this, but we're in a custom environment
    await writer.write(encoder.encode(`event: endpoint\ndata: /api/mcp?sessionId=${sessionId}\n\n`));

    return new Response(readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable buffering on Nginx (if applicable)
        },
    });
}
