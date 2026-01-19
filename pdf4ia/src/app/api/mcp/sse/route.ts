import { NextRequest } from 'next/server';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { getOrCreateServer, transports } from '../route';

/**
 * MCP SSE Initialization Endpoint
 * This route sets up the persistent SSE connection for ChatGPT and other remote clients.
 */
export async function GET(_request: NextRequest) {
    try {
        const server = getOrCreateServer();

        // Use a TransformStream for the SSE response
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();

        // Create a mock response object that SSEServerTransport expects
        const resMock = {
            statusCode: 200,
            setHeader: () => resMock,
            getHeader: () => undefined,
            removeHeader: () => resMock,
            writeHead: () => resMock,
            write: (chunk: any, _encoding?: string, callback?: any) => {
                if (typeof callback === 'function') callback();
                writer.write(typeof chunk === 'string' ? encoder.encode(chunk) : chunk);
                return true;
            },
            end: (chunk?: any, _encoding?: string, callback?: any) => {
                if (chunk) {
                    writer.write(typeof chunk === 'string' ? encoder.encode(chunk) : chunk);
                }
                if (typeof callback === 'function') callback();
                try {
                    writer.close();
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

        // Initialize the transport with the endpoint and our mock response
        const nextTransport = new SSEServerTransport('/api/mcp', resMock as any);

        // Get the generated sessionId from the transport
        const sessionId = (nextTransport as any).sessionId;
        if (!sessionId) {
            throw new Error("Failed to generate sessionId in transport");
        }

        // Store transport for later use in POST requests
        transports.set(sessionId, nextTransport);

        // Attach request to transport so tools can access it
        (nextTransport as any).request = _request;

        // Connect the server to this transport
        await server.connect(nextTransport);

        // The SSEServerTransport constructor should have already sent the endpoint event 
        // via res.write if we passed the endpoint string. 
        // But in case it didn't or our mock missed it:
        // await writer.write(encoder.encode(`event: endpoint\ndata: /api/mcp?sessionId=${sessionId}\n\n`));

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
            },
        });
    } catch (error) {
        console.error('MCP SSE Error:', error);
        return new Response(JSON.stringify({ error: (error as Error).message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
