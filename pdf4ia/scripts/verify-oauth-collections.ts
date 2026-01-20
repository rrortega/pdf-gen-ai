/**
 * Script para verificar y crear las colecciones OAuth necesarias
 * Ejecutar con: npx tsx scripts/verify-oauth-collections.ts
 */

import { Client, Databases, ID, Query } from 'node-appwrite';

const DATABASE_ID = process.env.NEXT_PUBLIC_DATABASE_ID || 'default';
const OAUTH_CODES_COLLECTION = process.env.OAUTH_CODES_COLLECTION_ID || 'oauth_codes';
const OAUTH_TOKENS_COLLECTION = process.env.OAUTH_TOKENS_COLLECTION_ID || 'oauth_tokens';

async function verifyCollections() {
    const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '')
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '')
        .setKey(process.env.APPWRITE_API_KEY || '');

    const databases = new Databases(client);

    console.log('🔍 Verificando colecciones OAuth...\n');
    console.log('Database ID:', DATABASE_ID);
    console.log('OAuth Codes Collection:', OAUTH_CODES_COLLECTION);
    console.log('OAuth Tokens Collection:', OAUTH_TOKENS_COLLECTION);
    console.log('');

    try {
        // Verificar oauth_codes
        console.log('📋 Verificando oauth_codes...');
        const codesResponse = await databases.listDocuments(
            DATABASE_ID,
            OAUTH_CODES_COLLECTION,
            [Query.limit(1)]
        );
        console.log('✅ oauth_codes existe y es accesible');
        console.log(`   Documentos encontrados: ${codesResponse.total}`);

        if (codesResponse.documents.length > 0) {
            console.log('   Ejemplo de documento:', JSON.stringify(codesResponse.documents[0], null, 2));
        }
    } catch (error) {
        console.error('❌ Error con oauth_codes:', (error as Error).message);
    }

    console.log('');

    try {
        // Verificar oauth_tokens
        console.log('📋 Verificando oauth_tokens...');
        const tokensResponse = await databases.listDocuments(
            DATABASE_ID,
            OAUTH_TOKENS_COLLECTION,
            [Query.limit(1)]
        );
        console.log('✅ oauth_tokens existe y es accesible');
        console.log(`   Documentos encontrados: ${tokensResponse.total}`);

        if (tokensResponse.documents.length > 0) {
            console.log('   Ejemplo de documento:', JSON.stringify(tokensResponse.documents[0], null, 2));
        }
    } catch (error) {
        console.error('❌ Error con oauth_tokens:', (error as Error).message);
        console.log('\n💡 Solución: Crea la colección oauth_tokens en Appwrite con los siguientes atributos:');
        console.log('   - client_id (string, 255)');
        console.log('   - user_id (string, 255)');
        console.log('   - access_token (string, 512)');
        console.log('   - refresh_token (string, 512)');
        console.log('   - token_type (string, 50)');
        console.log('   - expires_at (string, 50)');
        console.log('   - scopes (string[], array)');
        console.log('   - created_at (string, 50)');
    }

    console.log('');

    // Intentar crear un token de prueba
    try {
        console.log('🧪 Intentando crear un token de prueba...');
        const testToken = await databases.createDocument(
            DATABASE_ID,
            OAUTH_TOKENS_COLLECTION,
            ID.unique(),
            {
                client_id: 'test_client',
                user_id: 'test_user',
                access_token: 'test_access_token_' + Date.now(),
                refresh_token: 'test_refresh_token_' + Date.now(),
                token_type: 'Bearer',
                expires_at: new Date(Date.now() + 3600000).toISOString(),
                scopes: ['read', 'write'],
                created_at: new Date().toISOString(),
            }
        );
        console.log('✅ Token de prueba creado exitosamente:', testToken.$id);

        // Eliminar el token de prueba
        await databases.deleteDocument(DATABASE_ID, OAUTH_TOKENS_COLLECTION, testToken.$id);
        console.log('✅ Token de prueba eliminado');
    } catch (error) {
        console.error('❌ Error al crear token de prueba:', (error as Error).message);
        console.error('   Stack:', (error as Error).stack);
    }
}

verifyCollections().catch(console.error);
