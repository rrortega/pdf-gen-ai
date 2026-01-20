import { NextResponse } from 'next/server';

/**
 * OAuth 2.0 Authorization Server Metadata
 * RFC 8414: https://tools.ietf.org/html/rfc8414
 */
export async function GET() {
    const baseUrl = process.env.NEXT_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3030';

    return NextResponse.json({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/api/llm/mcp/auth`,
        token_endpoint: `${baseUrl}/api/llm/mcp/token`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    });
}
