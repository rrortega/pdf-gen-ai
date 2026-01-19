const sdk = require('node-appwrite');
const fs = require('fs');
const path = require('path');

// Basic .env parser to load environment variables manually if needed
function loadEnv() {
    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
        console.log('Loading environment variables from .env file...');
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) return;

            const firstEqual = trimmedLine.indexOf('=');
            if (firstEqual === -1) return;

            const key = trimmedLine.substring(0, firstEqual).trim();
            const value = trimmedLine.substring(firstEqual + 1).trim()
                .replace(/^["']/, '')
                .replace(/["']$/, '');

            if (key) {
                process.env[key] = value;
            }
        });
    }
}

// Load env vars
loadEnv();

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;

if (!endpoint || !projectId || !apiKey || !databaseId) {
    console.error('Missing required environment variables. Please check your .env file.');
    console.error({
        endpoint: !!endpoint,
        projectId: !!projectId,
        apiKey: !!apiKey,
        databaseId: !!databaseId
    });
    process.exit(1);
}

const client = new sdk.Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

const databases = new sdk.Databases(client);

// Define exactly which collections we WANT to keep
const USED_COLLECTIONS = ['templates', 'documents'];

async function cleanup() {
    console.log('--------------------------------------------------');
    console.log(`Starting Database Cleanup`);
    console.log(`Endpoint: ${endpoint}`);
    console.log(`Project ID: ${projectId}`);
    console.log(`Database ID: ${databaseId}`);
    console.log(`Keeping: ${USED_COLLECTIONS.join(', ')}`);
    console.log('--------------------------------------------------');

    try {
        // List all collections in the database
        const response = await databases.listCollections(databaseId);
        const collections = response.collections;

        console.log(`Found ${collections.length} total collections.`);

        let deletedCount = 0;
        let skippedCount = 0;

        for (const collection of collections) {
            const collectionId = collection.$id;
            const collectionName = collection.name;

            if (!USED_COLLECTIONS.includes(collectionId)) {
                console.log(`[DELETE] Unused collection found: "${collectionName}" (${collectionId})`);
                try {
                    await databases.deleteCollection(databaseId, collectionId);
                    console.log(`   └─ Successfully deleted.`);
                    deletedCount++;
                } catch (delError) {
                    console.error(`   └─ Failed to delete: ${delError.message}`);
                }
            } else {
                console.log(`[KEEP] Collection is in use: "${collectionName}" (${collectionId})`);
                skippedCount++;
            }
        }

        console.log('--------------------------------------------------');
        console.log('Cleanup Summary:');
        console.log(`- Total processed: ${collections.length}`);
        console.log(`- Deleted: ${deletedCount}`);
        console.log(`- Kept: ${skippedCount}`);
        console.log('--------------------------------------------------');

    } catch (error) {
        console.error('CRITICAL ERROR during cleanup:', error.message);
        if (error.response) {
            console.error('Appwrite response error:', error.response);
        }
    }
}

cleanup();
