import { NextRequest, NextResponse } from 'next/server';
import { OAuthClientsService, OAuthCodesService, OAuthTokensService } from '@/lib/oauth-service';
import { verifyPKCE } from '@/lib/oauth';

/**
 * OAuth 2.0 Token Endpoint
 * POST /api/oauth/token
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            grant_type,
            code,
            redirect_uri,
            client_id,
            client_secret,
            code_verifier,
            refresh_token,
        } = body;

        // Validate grant_type
        if (!grant_type || !['authorization_code', 'refresh_token'].includes(grant_type)) {
            return NextResponse.json(
                {
                    error: 'unsupported_grant_type',
                    error_description: 'grant_type must be "authorization_code" or "refresh_token"',
                },
                { status: 400 }
            );
        }

        // Handle authorization_code grant
        if (grant_type === 'authorization_code') {
            return await handleAuthorizationCodeGrant(
                code,
                redirect_uri,
                client_id,
                client_secret,
                code_verifier
            );
        }

        // Handle refresh_token grant
        if (grant_type === 'refresh_token') {
            return await handleRefreshTokenGrant(refresh_token, client_id, client_secret);
        }

        return NextResponse.json(
            { error: 'invalid_request', error_description: 'Invalid grant_type' },
            { status: 400 }
        );
    } catch (error: any) {
        console.error('OAuth token error:', error);
        return NextResponse.json(
            { error: 'server_error', error_description: error.message },
            { status: 500 }
        );
    }
}

/**
 * Handle authorization code grant
 */
async function handleAuthorizationCodeGrant(
    code: string,
    redirect_uri: string,
    client_id: string,
    client_secret: string,
    code_verifier?: string
) {
    // Validate required parameters
    if (!code || !redirect_uri || !client_id) {
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

    // Consume authorization code
    const authCode = await OAuthCodesService.consumeCode(code);
    if (!authCode) {
        return NextResponse.json(
            { error: 'invalid_grant', error_description: 'Invalid or expired authorization code' },
            { status: 400 }
        );
    }

    // Verify client_id matches
    if (authCode.client_id !== client_id) {
        return NextResponse.json(
            { error: 'invalid_grant', error_description: 'Client mismatch' },
            { status: 400 }
        );
    }

    // Verify redirect_uri matches
    if (authCode.redirect_uri !== redirect_uri) {
        return NextResponse.json(
            { error: 'invalid_grant', error_description: 'Redirect URI mismatch' },
            { status: 400 }
        );
    }

    // Verify PKCE if code_challenge was used
    if (authCode.code_challenge) {
        if (!code_verifier) {
            return NextResponse.json(
                { error: 'invalid_request', error_description: 'code_verifier required' },
                { status: 400 }
            );
        }

        const isValidPKCE = verifyPKCE(
            code_verifier,
            authCode.code_challenge,
            authCode.code_challenge_method || 'S256'
        );

        if (!isValidPKCE) {
            return NextResponse.json(
                { error: 'invalid_grant', error_description: 'Invalid code_verifier' },
                { status: 400 }
            );
        }
    }

    // Generate access token
    const tokenResponse = await OAuthTokensService.createToken(
        authCode.client_id,
        authCode.user_id,
        authCode.scopes,
        true
    );

    return NextResponse.json(tokenResponse);
}

/**
 * Handle refresh token grant
 */
async function handleRefreshTokenGrant(
    refresh_token: string,
    client_id: string,
    client_secret: string
) {
    // Validate required parameters
    if (!refresh_token || !client_id || !client_secret) {
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

    // Refresh the token
    const tokenResponse = await OAuthTokensService.refreshToken(refresh_token);
    if (!tokenResponse) {
        return NextResponse.json(
            { error: 'invalid_grant', error_description: 'Invalid refresh token' },
            { status: 400 }
        );
    }

    return NextResponse.json(tokenResponse);
}
