import { getServerAppwriteTables, getServerAppwriteUsers, DATABASE_ID } from './appwrite';
import { ID, Query } from 'node-appwrite';
import {
    OAuthToken,
    OAuthAuthorizationCode,
    generateAuthorizationCode,
    generateAccessToken,
    generateRefreshToken,
} from './oauth';

// Collection IDs
export const OAUTH_TOKENS_COLLECTION = process.env.OAUTH_TOKENS_COLLECTION_ID || 'oauth_tokens';
export const OAUTH_CODES_COLLECTION = process.env.OAUTH_CODES_COLLECTION_ID || 'oauth_codes';

/**
 * OAuth Clients Service
 * Uses Appwrite User ID as client_id and API Key as client_secret
 */
export class OAuthClientsService {
    /**
     * Verify client credentials using User ID and API Key
     */
    static async verifyClient(userId: string, apiKey: string): Promise<boolean> {
        try {
            const users = getServerAppwriteUsers();
            const user = await users.get(userId);

            // Check if the provided API key matches the one in user prefs
            // User confirmed the API key is stored in the user object
            return user.prefs?.apikey === apiKey;
        } catch (error) {
            console.error('Error verifying OAuth client:', error);
            return false;
        }
    }

    /**
     * Get user ID from API key
     * Note: This is more expensive now as we have to list users.
     * Only use if necessary. In standard OAuth, we have the client_id (userId).
     */
    static async getUserIdFromApiKey(apiKey: string): Promise<string | null> {
        try {
            const users = getServerAppwriteUsers();
            // Appwrite doesn't support searching prefs directly via users.list.
            // We list the most recent users and find the one with the matching key.
            const response = await users.list([
                Query.orderDesc('$createdAt'),
                Query.limit(100)
            ]);

            const user = response.users.find(u => u.prefs?.apikey === apiKey);
            return user?.$id || null;
        } catch (error) {
            console.error('Error finding user from API key:', error);
            return null;
        }
    }
}

/**
 * OAuth Authorization Codes Service
 */
export class OAuthCodesService {
    /**
     * Create authorization code
     */
    static async createCode(
        clientId: string,
        userId: string,
        redirectUri: string,
        scopes: string[],
        codeChallenge?: string,
        codeChallengeMethod?: 'S256' | 'plain'
    ): Promise<{ code: string; expiresAt: string }> {
        const code = generateAuthorizationCode();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

        const tables = getServerAppwriteTables();
        await tables.createRow({
            databaseId: DATABASE_ID,
            tableId: OAUTH_CODES_COLLECTION,
            rowId: ID.unique(),
            data: {
                code,
                client_id: clientId,
                user_id: userId,
                redirect_uri: redirectUri,
                scopes,
                code_challenge: codeChallenge || '',
                code_challenge_method: codeChallengeMethod || '',
                expires_at: expiresAt,
                created_at: new Date().toISOString(),
            }
        });

        return { code, expiresAt };
    }

    /**
     * Get and consume authorization code
     */
    static async consumeCode(code: string): Promise<OAuthAuthorizationCode | null> {
        try {
            const tables = getServerAppwriteTables();
            const response = await tables.listRows({
                databaseId: DATABASE_ID,
                tableId: OAUTH_CODES_COLLECTION,
                queries: [Query.equal('code', code), Query.limit(1)]
            });

            if (response.rows.length === 0) {
                return null;
            }

            const authCode = response.rows[0] as unknown as OAuthAuthorizationCode;

            // Check if expired
            if (new Date(authCode.expires_at) < new Date()) {
                await tables.deleteRow({
                    databaseId: DATABASE_ID,
                    tableId: OAUTH_CODES_COLLECTION,
                    rowId: authCode.$id
                });
                return null;
            }

            // Delete code (one-time use)
            await tables.deleteRow({
                databaseId: DATABASE_ID,
                tableId: OAUTH_CODES_COLLECTION,
                rowId: authCode.$id
            });

            return authCode;
        } catch (error) {
            console.error('Error consuming authorization code:', error);
            return null;
        }
    }
}

/**
 * OAuth Tokens Service
 */
export class OAuthTokensService {
    /**
     * Create access token
     */
    static async createToken(
        clientId: string,
        userId: string,
        scopes: string[],
        includeRefreshToken: boolean = true
    ): Promise<{
        access_token: string;
        refresh_token?: string;
        token_type: 'Bearer';
        expires_in: number;
        scope: string;
    }> {
        const accessToken = generateAccessToken();
        const refreshToken = includeRefreshToken ? generateRefreshToken() : undefined;
        const expiresIn = 3600; // 1 hour
        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

        const tables = getServerAppwriteTables();
        await tables.createRow({
            databaseId: DATABASE_ID,
            tableId: OAUTH_TOKENS_COLLECTION,
            rowId: ID.unique(),
            data: {
                client_id: clientId,
                user_id: userId,
                access_token: accessToken,
                refresh_token: refreshToken || '',
                token_type: 'Bearer',
                expires_at: expiresAt,
                scopes,
                created_at: new Date().toISOString(),
            }
        });

        return {
            access_token: accessToken,
            refresh_token: refreshToken,
            token_type: 'Bearer',
            expires_in: expiresIn,
            scope: scopes.join(' '),
        };
    }

    /**
     * Verify access token
     */
    static async verifyToken(accessToken: string): Promise<OAuthToken | null> {
        try {
            const tables = getServerAppwriteTables();
            const response = await tables.listRows({
                databaseId: DATABASE_ID,
                tableId: OAUTH_TOKENS_COLLECTION,
                queries: [Query.equal('access_token', accessToken), Query.limit(1)]
            });

            if (response.rows.length === 0) {
                return null;
            }

            const token = response.rows[0] as unknown as OAuthToken;

            // Check if expired
            if (new Date(token.expires_at) < new Date()) {
                await tables.deleteRow({
                    databaseId: DATABASE_ID,
                    tableId: OAUTH_TOKENS_COLLECTION,
                    rowId: token.$id
                });
                return null;
            }

            return token;
        } catch (error) {
            console.error('Error verifying token:', error);
            return null;
        }
    }

    /**
     * Refresh access token
     */
    static async refreshToken(refreshToken: string): Promise<{
        access_token: string;
        refresh_token?: string;
        token_type: 'Bearer';
        expires_in: number;
        scope: string;
    } | null> {
        try {
            const tables = getServerAppwriteTables();
            const response = await tables.listRows({
                databaseId: DATABASE_ID,
                tableId: OAUTH_TOKENS_COLLECTION,
                queries: [Query.equal('refresh_token', refreshToken), Query.limit(1)]
            });

            if (response.rows.length === 0) {
                return null;
            }

            const oldToken = response.rows[0] as unknown as OAuthToken;

            // Delete old token
            await tables.deleteRow({
                databaseId: DATABASE_ID,
                tableId: OAUTH_TOKENS_COLLECTION,
                rowId: oldToken.$id
            });

            // Create new token
            return await this.createToken(
                oldToken.client_id,
                oldToken.user_id,
                oldToken.scopes,
                true
            );
        } catch (error) {
            console.error('Error refreshing token:', error);
            return null;
        }
    }

    /**
     * Revoke token
     */
    static async revokeToken(token: string): Promise<boolean> {
        try {
            const tables = getServerAppwriteTables();
            const response = await tables.listRows({
                databaseId: DATABASE_ID,
                tableId: OAUTH_TOKENS_COLLECTION,
                queries: [
                    Query.or([
                        Query.equal('access_token', token),
                        Query.equal('refresh_token', token),
                    ]),
                    Query.limit(1),
                ]
            });

            if (response.rows.length === 0) {
                return false;
            }

            await tables.deleteRow({
                databaseId: DATABASE_ID,
                tableId: OAUTH_TOKENS_COLLECTION,
                rowId: response.rows[0].$id
            });

            return true;
        } catch (error) {
            console.error('Error revoking token:', error);
            return false;
        }
    }

    /**
     * Get user tokens for a client
     */
    static async getUserClientTokens(userId: string, clientId: string): Promise<OAuthToken[]> {
        const tables = getServerAppwriteTables();
        const response = await tables.listRows({
            databaseId: DATABASE_ID,
            tableId: OAUTH_TOKENS_COLLECTION,
            queries: [
                Query.equal('user_id', userId),
                Query.equal('client_id', clientId),
                Query.orderDesc('$createdAt'),
            ]
        });

        return response.rows as unknown as OAuthToken[];
    }
}
