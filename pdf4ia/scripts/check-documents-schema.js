const { Client, Databases } = require('node-appwrite');

const client = new Client()
    .setEndpoint("https://aw.chamba.pro/v1")
    .setProject("6967f2f7001ae2212a9b")
    .setKey("standard_26c82b29266f1de3aa69c8c660dcaf3b734029eb4316a4de3614d9f53696676829fc339cbc44407b3f13f5dd4469905ee81db59847d7c73539bb9ad5b1060e162897674a7e5f34bb52919a0c07a9d82e7fdb11f5a03e63099ab289d5b1480a158e420d8a778d723009e441875489e73e42e410c56b5664ea35fd5c8ab502633e");

const databases = new Databases(client);
const DATABASE_ID = "6968108e00298587f520";
const COLLECTION_ID = "documents";

async function updateSchema() {
    try {
        console.log("Adding missing attributes...");

        try {
            await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, "data", 5000000, false);
            console.log("- Added 'data' attribute");
        } catch (e) {
            console.log("- 'data' attribute already exists or failed:", e.message);
        }

        try {
            await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, "status", 32, true);
            console.log("- Added 'status' attribute");
        } catch (e) {
            console.log("- 'status' attribute already exists or failed:", e.message);
        }

        try {
            await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, "error_message", 1000, false);
            console.log("- Added 'error_message' attribute");
        } catch (e) {
            console.log("- 'error_message' attribute already exists or failed:", e.message);
        }

        console.log("Schema update completed.");
    } catch (error) {
        console.error("Critical Error:", error.message);
    }
}

updateSchema();
