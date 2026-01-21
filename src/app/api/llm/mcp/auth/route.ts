import { NextRequest, NextResponse, connection } from 'next/server';
import { OAuthCodesService } from '@/lib/oauth-service';
import { getAppwriteAccount } from '@/lib/appwrite';

/**
 * OAuth Authorization Endpoint
 * Handles user consent and generates authorization code
 */
export async function GET(request: NextRequest) {
    await connection();
    try {
        const searchParams = request.nextUrl.searchParams;
        const clientId = searchParams.get('client_id');
        const redirectUri = searchParams.get('redirect_uri');
        const state = searchParams.get('state');
        const codeChallenge = searchParams.get('code_challenge');
        const codeChallengeMethod = searchParams.get('code_challenge_method') as 'S256' | 'plain' | null;
        const scope = searchParams.get('scope') || 'read write';

        console.log('[OAuth Auth] Request received:', {
            clientId,
            redirectUri,
            state,
            scope,
            hasCodeChallenge: !!codeChallenge
        });

        // Validate required parameters
        if (!clientId || !redirectUri) {
            return new NextResponse('Missing required parameters: client_id and redirect_uri', { status: 400 });
        }

        // Check if user is authenticated
        let userId: string;
        try {
            const account = await getAppwriteAccount();
            const user = await account.get();
            userId = user.$id;
            console.log('[OAuth Auth] User authenticated:', userId);
        } catch {
            // Redirect to consent page (which will handle login if needed)
            const baseUrl = process.env.NEXT_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
            const consentUrl = new URL('/oauth/consent', baseUrl);

            // Pass all OAuth parameters to consent page
            searchParams.forEach((value, key) => {
                consentUrl.searchParams.set(key, value);
            });

            console.log('[OAuth Auth] User not authenticated, redirecting to consent page');
            return NextResponse.redirect(consentUrl);
        }

        // User is authenticated, generate authorization code
        console.log('[OAuth Auth] Generating authorization code...');
        const scopes = scope.split(' ');
        const { code } = await OAuthCodesService.createCode(
            clientId,
            userId,
            redirectUri,
            scopes,
            codeChallenge || undefined,
            codeChallengeMethod || undefined
        );

        console.log('[OAuth Auth] Code generated, redirecting to:', redirectUri);

        // Redirect back to client with code
        const callbackUrl = new URL(redirectUri);
        callbackUrl.searchParams.set('code', code);
        if (state) {
            callbackUrl.searchParams.set('state', state);
        }

        return NextResponse.redirect(callbackUrl.toString());
    } catch (error) {
        console.error('[OAuth Auth] Error:', error);
        return new NextResponse('Internal server error', { status: 500 });
    }
}
