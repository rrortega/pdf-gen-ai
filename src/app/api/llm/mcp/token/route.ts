import { NextRequest, NextResponse } from 'next/server';
import { OAuthClientsService, OAuthCodesService, OAuthTokensService } from '@/lib/oauth-service';
import { verifyPKCE } from '@/lib/oauth';

/**
 * OAuth Token Endpoint
 * Exchanges authorization code for access token
 */
export async function POST(request: NextRequest) {
    try {
        const contentType = request.headers.get('content-type') || '';
        let body: Record<string, string> = {};

        if (contentType.includes('application/x-www-form-urlencoded')) {
            const formData = await request.formData();
            formData.forEach((value, key) => {
                body[key] = value.toString();
            });
        } else {
            try {
                body = await request.json();
            } catch {
                console.warn('[OAuth Token] Failed to parse as JSON, trying form data fallback');
                const formData = await request.formData();
                formData.forEach((value, key) => {
                    body[key] = value.toString();
                });
            }
        }

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
    } catch (error) {
        console.error('[OAuth Token] Error:', error);
        console.error('[OAuth Token] Stack:', (error as Error).stack);
        return NextResponse.json(
            { error: 'server_error', error_description: (error as Error).message },
            { status: 500 }
        );
    }
}

async function handleAuthorizationCodeGrant(
    code: string,
    redirect_uri: string,
    client_id: string,
    client_secret: string,
    code_verifier?: string
) {
    console.log('[OAuth Token] Authorization code grant request:', {
        code: code?.substring(0, 10) + '...',
        redirect_uri,
        client_id,
        has_client_secret: !!client_secret,
        has_code_verifier: !!code_verifier
    });

    if (!code || !redirect_uri || !client_id) {
        return NextResponse.json(
            { error: 'invalid_request', error_description: 'Missing required parameters' },
            { status: 400 }
        );
    }

    console.log('[OAuth Token] Verifying client...');

    // For OAuth flow, we only verify that the client_id matches the authorization code
    // The client_secret is optional for public clients like ChatGPT
    console.log('[OAuth Token] Consuming authorization code...');

    const authCode = await OAuthCodesService.consumeCode(code);
    if (!authCode) {
        console.log('[OAuth Token] Invalid or expired code');
        return NextResponse.json(
            { error: 'invalid_grant', error_description: 'Invalid or expired authorization code' },
            { status: 400 }
        );
    }

    console.log('[OAuth Token] Code consumed successfully:', {
        code_client_id: authCode.client_id,
        request_client_id: client_id,
        user_id: authCode.user_id
    });

    if (authCode.client_id !== client_id) {
        return NextResponse.json(
            { error: 'invalid_grant', error_description: 'Client mismatch' },
            { status: 400 }
        );
    }

    if (authCode.redirect_uri !== redirect_uri) {
        console.log('[OAuth Token] Redirect URI mismatch:', {
            expected: authCode.redirect_uri,
            received: redirect_uri
        });
        return NextResponse.json(
            { error: 'invalid_grant', error_description: 'Redirect URI mismatch' },
            { status: 400 }
        );
    }

    console.log('[OAuth Token] Checking PKCE...');
    if (authCode.code_challenge) {
        if (!code_verifier) {
            console.log('[OAuth Token] PKCE: code_verifier required but not provided');
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
            console.log('[OAuth Token] PKCE verification failed');
            return NextResponse.json(
                { error: 'invalid_grant', error_description: 'Invalid code_verifier' },
                { status: 400 }
            );
        }
        console.log('[OAuth Token] PKCE verified successfully');
    } else {
        console.log('[OAuth Token] No PKCE challenge, skipping verification');
    }

    console.log('[OAuth Token] Creating access token...', {
        client_id: authCode.client_id,
        user_id: authCode.user_id,
        scopes: authCode.scopes
    });

    try {
        const tokenResponse = await OAuthTokensService.createToken(
            authCode.client_id,
            authCode.user_id,
            authCode.scopes,
            true
        );

        console.log('[OAuth Token] Token created successfully');
        return NextResponse.json(tokenResponse);
    } catch (tokenError) {
        console.error('[OAuth Token] Failed to create token:', tokenError);
        console.error('[OAuth Token] Token error stack:', (tokenError as Error).stack);
        return NextResponse.json(
            { error: 'server_error', error_description: 'Failed to create access token: ' + (tokenError as Error).message },
            { status: 500 }
        );
    }
}

async function handleRefreshTokenGrant(
    refresh_token: string,
    client_id: string,
    client_secret: string
) {
    if (!refresh_token || !client_id || !client_secret) {
        return NextResponse.json(
            { error: 'invalid_request', error_description: 'Missing required parameters' },
            { status: 400 }
        );
    }

    const isValidClient = await OAuthClientsService.verifyClient(client_id, client_secret);
    if (!isValidClient) {
        return NextResponse.json(
            { error: 'invalid_client', error_description: 'Invalid client credentials' },
            { status: 401 }
        );
    }

    const tokenResponse = await OAuthTokensService.refreshToken(refresh_token);
    if (!tokenResponse) {
        return NextResponse.json(
            { error: 'invalid_grant', error_description: 'Invalid refresh token' },
            { status: 400 }
        );
    }

    return NextResponse.json(tokenResponse);
}
