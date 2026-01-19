import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { account } from '@/lib/appwrite';
import { OAuthClientsService, OAuthCodesService } from '@/lib/oauth-service';
import { validateRedirectUri, validateScopes } from '@/lib/oauth';

/**
 * OAuth 2.0 Authorization Endpoint
 * GET /api/oauth/authorize
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;

    const response_type = searchParams.get('response_type');
    const client_id = searchParams.get('client_id');
    const redirect_uri = searchParams.get('redirect_uri');
    const scope = searchParams.get('scope');
    const state = searchParams.get('state');
    const code_challenge = searchParams.get('code_challenge');
    const code_challenge_method = searchParams.get('code_challenge_method') as 'S256' | 'plain' | null;

    // Validate required parameters
    if (!response_type || response_type !== 'code') {
        return NextResponse.json(
            { error: 'invalid_request', error_description: 'response_type must be "code"' },
            { status: 400 }
        );
    }

    if (!client_id || !redirect_uri || !scope) {
        return NextResponse.json(
            { error: 'invalid_request', error_description: 'Missing required parameters' },
            { status: 400 }
        );
    }

    try {
        // Get client
        const client = await OAuthClientsService.getClientByClientId(client_id);
        if (!client) {
            return NextResponse.json(
                { error: 'invalid_client', error_description: 'Client not found' },
                { status: 401 }
            );
        }

        // Validate redirect URI
        if (!validateRedirectUri(redirect_uri, client.redirect_uris)) {
            return NextResponse.json(
                { error: 'invalid_request', error_description: 'Invalid redirect_uri' },
                { status: 400 }
            );
        }

        // Validate scopes
        const requestedScopes = scope.split(' ');
        if (!validateScopes(requestedScopes)) {
            return redirectWithError(redirect_uri, 'invalid_scope', 'Invalid scope requested', state);
        }

        // Check if user is authenticated
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session');

        if (!sessionCookie) {
            // Redirect to login with return URL
            const loginUrl = new URL('/login', request.url);
            loginUrl.searchParams.set('returnUrl', request.url);
            return NextResponse.redirect(loginUrl);
        }

        try {
            // Verify session and get user
            const user = await account.get();

            // Generate authorization code
            const { code } = await OAuthCodesService.createCode(
                client_id,
                user.$id,
                redirect_uri,
                requestedScopes,
                code_challenge || undefined,
                code_challenge_method || undefined
            );

            // Redirect back to client with code
            const redirectUrl = new URL(redirect_uri);
            redirectUrl.searchParams.set('code', code);
            if (state) {
                redirectUrl.searchParams.set('state', state);
            }

            return NextResponse.redirect(redirectUrl.toString());
        } catch (error) {
            // Session invalid, redirect to login
            const loginUrl = new URL('/login', request.url);
            loginUrl.searchParams.set('returnUrl', request.url);
            return NextResponse.redirect(loginUrl);
        }
    } catch (error: any) {
        console.error('OAuth authorization error:', error);
        return NextResponse.json(
            { error: 'server_error', error_description: error.message },
            { status: 500 }
        );
    }
}

/**
 * Helper to redirect with error
 */
function redirectWithError(
    redirectUri: string,
    error: string,
    errorDescription: string,
    state?: string | null
): NextResponse {
    const url = new URL(redirectUri);
    url.searchParams.set('error', error);
    url.searchParams.set('error_description', errorDescription);
    if (state) {
        url.searchParams.set('state', state);
    }
    return NextResponse.redirect(url.toString());
}
