import crypto from 'crypto';

export interface OAuthClient {
    $id: string;
    user_id: string;
    client_id: string;
    client_secret: string;
    name: string;
    description?: string;
    redirect_uris: string[];
    scopes: string[];
    created_at: string;
    updated_at: string;
}

export interface OAuthToken {
    $id: string;
    client_id: string;
    user_id: string;
    access_token: string;
    refresh_token?: string;
    token_type: 'Bearer';
    expires_at: string;
    scopes: string[];
    created_at: string;
}

export interface OAuthAuthorizationCode {
    $id: string;
    code: string;
    client_id: string;
    user_id: string;
    redirect_uri: string;
    scopes: string[];
    code_challenge?: string;
    code_challenge_method?: 'S256' | 'plain';
    expires_at: string;
    created_at: string;
}

// Available OAuth scopes
export const OAUTH_SCOPES = {
    'templates:read': 'Read templates',
    'templates:write': 'Create and modify templates',
    'documents:read': 'Read generated documents',
    'documents:write': 'Generate PDF documents',
    'documents:delete': 'Delete documents',
} as const;

export type OAuthScope = keyof typeof OAUTH_SCOPES;

/**
 * Generate a secure random string
 */
export function generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64url');
}

/**
 * Generate OAuth client credentials
 */
export function generateClientCredentials() {
    return {
        client_id: `client_${generateSecureToken(16)}`,
        client_secret: generateSecureToken(32),
    };
}

/**
 * Generate authorization code
 */
export function generateAuthorizationCode(): string {
    return generateSecureToken(32);
}

/**
 * Generate access token
 */
export function generateAccessToken(): string {
    return generateSecureToken(32);
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(): string {
    return generateSecureToken(32);
}

/**
 * Verify PKCE code challenge
 */
export function verifyPKCE(
    codeVerifier: string,
    codeChallenge: string,
    method: 'S256' | 'plain' = 'S256'
): boolean {
    if (method === 'plain') {
        return codeVerifier === codeChallenge;
    }

    // S256: BASE64URL(SHA256(code_verifier))
    const hash = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

    return hash === codeChallenge;
}

/**
 * Validate redirect URI
 */
export function validateRedirectUri(uri: string, allowedUris: string[]): boolean {
    return allowedUris.some(allowed => {
        // Exact match
        if (uri === allowed) return true;

        // Wildcard subdomain match (e.g., https://*.example.com/callback)
        if (allowed.includes('*')) {
            const pattern = allowed.replace(/\*/g, '[^/]+');
            const regex = new RegExp(`^${pattern}$`);
            return regex.test(uri);
        }

        return false;
    });
}

/**
 * Validate scopes
 */
export function validateScopes(requestedScopes: string[]): boolean {
    return requestedScopes.every(scope => scope in OAUTH_SCOPES);
}

/**
 * Check if token has required scope
 */
export function hasScope(tokenScopes: string[], requiredScope: OAuthScope): boolean {
    return tokenScopes.includes(requiredScope);
}

/**
 * Parse Bearer token from Authorization header
 */
export function parseBearerToken(authHeader?: string): string | null {
    if (!authHeader) return null;

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return null;
    }

    return parts[1];
}
