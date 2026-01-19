import { NextRequest } from 'next/server';
import { GET as handleSSE } from '../api/mcp/sse/route';

/**
 * Proxy route for /mcp-server to support ChatGPT and other clients
 * that already use this URL.
 */
export async function GET(request: NextRequest) {
    // Check if it's an SSE request (Accept: text/event-stream)
    const accept = request.headers.get('accept');
    if (accept && accept.includes('text/event-stream')) {
        return handleSSE(request);
    }

    // Otherwise, redirect to the documentation page
    return Response.redirect(new URL('/mcp', request.url));
}

// Support POST for MCP messages
export async function POST(request: NextRequest) {
    const { POST: handlePost } = await import('../api/mcp/route');
    return handlePost(request);
}
