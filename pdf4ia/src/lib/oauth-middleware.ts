import { NextRequest } from 'next/server';
import { OAuthTokensService } from './oauth-service';
import { parseBearerToken, hasScope, OAuthScope } from './oauth';

export interface OAuthContext {
    userId: string;
    clientId: string;
    scopes: string[];
}

/**
 * Verify OAuth token from request
 */
export async function verifyOAuthToken(request: NextRequest): Promise<OAuthContext | null> {
    const authHeader = request.headers.get('authorization');
    const accessToken = parseBearerToken(authHeader ?? undefined);

    if (!accessToken) {
        return null;
    }

    const token = await OAuthTokensService.verifyToken(accessToken);
    if (!token) {
        return null;
    }

    return {
        userId: token.user_id,
        clientId: token.client_id,
        scopes: token.scopes,
    };
}

/**
 * Require OAuth authentication middleware
 */
export async function requireOAuth(
    request: NextRequest,
    requiredScopes?: OAuthScope[]
): Promise<{ context: OAuthContext } | { error: Response }> {
    const context = await verifyOAuthToken(request);

    if (!context) {
        return {
            error: new Response(
                JSON.stringify({
                    error: 'invalid_token',
                    error_description: 'Invalid or expired access token',
                }),
                {
                    status: 401,
                    headers: {
                        'Content-Type': 'application/json',
                        'WWW-Authenticate': 'Bearer realm="PDFGenAI API"',
                    },
                }
            ),
        };
    }

    // Check required scopes
    if (requiredScopes && requiredScopes.length > 0) {
        const hasAllScopes = requiredScopes.every(scope => hasScope(context.scopes, scope));

        if (!hasAllScopes) {
            return {
                error: new Response(
                    JSON.stringify({
                        error: 'insufficient_scope',
                        error_description: `Required scopes: ${requiredScopes.join(', ')}`,
                    }),
                    {
                        status: 403,
                        headers: {
                            'Content-Type': 'application/json',
                            'WWW-Authenticate': `Bearer realm="PDFGenAI API", scope="${requiredScopes.join(' ')}"`,
                        },
                    }
                ),
            };
        }
    }

    return { context };
}
