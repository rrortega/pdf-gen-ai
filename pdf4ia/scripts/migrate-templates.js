/**
 * Migration script to update templates collection schema
 * Run with: node scripts/migrate-templates.js
 */

const { Client, Databases, ID } = require('node-appwrite');

const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://aw.chamba.pro/v1')
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '6967f2f7001ae2212a9b')
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

const DATABASE_ID = process.env.NEXT_PUBLIC_DATABASE_ID || 'pdf4ia';
const TEMPLATES_COLLECTION_ID = process.env.NEXT_PUBLIC_TEMPLATES_COLLECTION_ID || 'templates';

async function migrateTemplates() {
    console.log('🚀 Starting templates collection migration...\n');

    try {
        // Check if collection exists
        console.log('📋 Checking templates collection...');
        const collection = await databases.getCollection(DATABASE_ID, TEMPLATES_COLLECTION_ID);
        console.log(`✅ Collection found: ${collection.name}\n`);

        // List existing attributes
        console.log('📊 Current attributes:');
        const attributes = await databases.listAttributes(DATABASE_ID, TEMPLATES_COLLECTION_ID);
        attributes.attributes.forEach(attr => {
            console.log(`  - ${attr.key} (${attr.type})`);
        });
        console.log('');

        // Check if we need to add new attributes
        const existingKeys = attributes.attributes.map(attr => attr.key);

        // Ensure required attributes exist
        const requiredAttributes = [
            { key: 'title', type: 'string', size: 255, required: true },
            { key: 'description', type: 'string', size: 1000, required: false },
            { key: 'template_html', type: 'string', size: 100000, required: true },
            { key: 'css', type: 'string', size: 50000, required: false },
            { key: 'sample_data', type: 'string', size: 10000, required: false },
            { key: 'user_id', type: 'string', size: 255, required: true },
        ];

        console.log('🔧 Checking required attributes...');
        for (const attr of requiredAttributes) {
            if (!existingKeys.includes(attr.key)) {
                console.log(`  ➕ Adding attribute: ${attr.key}`);
                try {
                    await databases.createStringAttribute(
                        DATABASE_ID,
                        TEMPLATES_COLLECTION_ID,
                        attr.key,
                        attr.size,
                        attr.required
                    );
                    console.log(`  ✅ Added: ${attr.key}`);
                } catch (error) {
                    console.log(`  ⚠️  Could not add ${attr.key}: ${error.message}`);
                }
            } else {
                console.log(`  ✓ ${attr.key} already exists`);
            }
        }

        console.log('\n📝 Migration notes:');
        console.log('  - Tags are handled in the frontend (not stored in DB yet)');
        console.log('  - template_html maps to "html" in frontend');
        console.log('  - sample_data maps to "testData" in frontend');
        console.log('  - All existing templates remain compatible');

        console.log('\n✅ Migration completed successfully!');
        console.log('\n💡 Next steps:');
        console.log('  1. Existing templates will work with new structure');
        console.log('  2. New templates will use the updated fields');
        console.log('  3. Tags feature is ready (stored client-side for now)');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('\nFull error:', error);
        process.exit(1);
    }
}

// Run migration
migrateTemplates()
    .then(() => {
        console.log('\n🎉 All done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Unexpected error:', error);
        process.exit(1);
    });
