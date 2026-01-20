import { NextRequest, NextResponse } from 'next/server';
import { OAuthCodesService } from '@/lib/oauth-service';
import { getAppwriteAccount } from '@/lib/appwrite';

/**
 * OAuth Authorization Endpoint
 * Handles user consent and generates authorization code
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const clientId = searchParams.get('client_id');
        const redirectUri = searchParams.get('redirect_uri');
        const state = searchParams.get('state');
        const codeChallenge = searchParams.get('code_challenge');
        const codeChallengeMethod = searchParams.get('code_challenge_method') as 'S256' | 'plain' | null;
        const scope = searchParams.get('scope') || 'read write';

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
        } catch {
            // Redirect to login with return URL
            const baseUrl = process.env.NEXT_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
            const loginUrl = new URL('/login', baseUrl);
            loginUrl.searchParams.set('redirect', request.url);
            return NextResponse.redirect(loginUrl);
        }

        // Generate authorization code
        const scopes = scope.split(' ');
        const { code } = await OAuthCodesService.createCode(
            clientId,
            userId,
            redirectUri,
            scopes,
            codeChallenge || undefined,
            codeChallengeMethod || undefined
        );

        // Redirect back to client with code
        const callbackUrl = new URL(redirectUri);
        callbackUrl.searchParams.set('code', code);
        if (state) {
            callbackUrl.searchParams.set('state', state);
        }

        return NextResponse.redirect(callbackUrl.toString());
    } catch (error) {
        console.error('OAuth authorization error:', error);
        return new NextResponse('Internal server error', { status: 500 });
    }
}
