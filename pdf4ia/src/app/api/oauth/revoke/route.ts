import { NextRequest, NextResponse } from 'next/server';
import { OAuthTokensService, OAuthClientsService } from '@/lib/oauth-service';

/**
 * OAuth 2.0 Token Revocation Endpoint
 * POST /api/oauth/revoke
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { token, client_id, client_secret } = body;

        // Validate required parameters
        if (!token || !client_id || !client_secret) {
            return NextResponse.json(
                { error: 'invalid_request', error_description: 'Missing required parameters' },
                { status: 400 }
            );
        }

        // Verify client credentials
        const isValidClient = await OAuthClientsService.verifyClient(client_id, client_secret);
        if (!isValidClient) {
            return NextResponse.json(
                { error: 'invalid_client', error_description: 'Invalid client credentials' },
                { status: 401 }
            );
        }

        // Revoke the token
        await OAuthTokensService.revokeToken(token);

        // Return 200 OK even if token doesn't exist (per OAuth 2.0 spec)
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('OAuth revoke error:', error);
        return NextResponse.json(
            { error: 'server_error', error_description: error.message },
            { status: 500 }
        );
    }
}
