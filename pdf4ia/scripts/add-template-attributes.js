const { Client, Databases } = require('node-appwrite');

const client = new Client()
    .setEndpoint('https://aw.chamba.pro/v1')
    .setProject('6967f2f7001ae2212a9b')
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DATABASE_ID = '6968108e00298587f520';
const COLLECTION_ID = 'templates';

async function main() {
    console.log('Starting migration...');

    try {
        // Enums
        console.log('Creating orientation attribute...');
        await databases.createEnumAttribute(DATABASE_ID, COLLECTION_ID, 'orientation', ['portrait', 'landscape'], false, 'portrait');

        console.log('Creating paper_size attribute...');
        await databases.createEnumAttribute(DATABASE_ID, COLLECTION_ID, 'paper_size', ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'Letter'], false, 'A4');

        // Margins
        console.log('Creating margin attributes...');
        await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'margin_top', 20, false, '20px');
        await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'margin_right', 20, false, '20px');
        await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'margin_bottom', 20, false, '20px');
        await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'margin_left', 20, false, '20px');

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error.message);
        if (error.response) {
            console.error('Response:', error.response);
        }
    }
}

main();
