const { Client, Databases } = require('node-appwrite');

const client = new Client()
    .setEndpoint("https://aw.chamba.pro/v1")
    .setProject("6967f2f7001ae2212a9b")
    .setKey("standard_26c82b29266f1de3aa69c8c660dcaf3b734029eb4316a4de3614d9f53696676829fc339cbc44407b3f13f5dd4469905ee81db59847d7c73539bb9ad5b1060e162897674a7e5f34bb52919a0c07a9d82e7fdb11f5a03e63099ab289d5b1480a158e420d8a778d723009e441875489e73e42e410c56b5664ea35fd5c8ab502633e");

const databases = new Databases(client);
const DATABASE_ID = "6968108e00298587f520";
const COLLECTION_ID = "documents";

async function addSizeAttribute() {
    try {
        console.log("Adding 'size' and 'downloads' attributes to documents collection...");

        // Add size attribute
        try {
            await databases.createIntegerAttribute(
                DATABASE_ID,
                COLLECTION_ID,
                "size",
                false, // required
                0,     // min
                999999999, // max
                0      // default
            );
            console.log("✓ Successfully added 'size' attribute (integer, default: 0)");
        } catch (e) {
            if (e.message?.includes('already exists') || e.message?.includes('Attribute already exists')) {
                console.log("✓ 'size' attribute already exists");
            } else {
                throw e;
            }
        }

        // Add downloads attribute
        try {
            await databases.createIntegerAttribute(
                DATABASE_ID,
                COLLECTION_ID,
                "downloads",
                false, // required
                0,     // min
                999999999, // max
                0      // default
            );
            console.log("✓ Successfully added 'downloads' attribute (integer, default: 0)");
        } catch (e) {
            if (e.message?.includes('already exists') || e.message?.includes('Attribute already exists')) {
                console.log("✓ 'downloads' attribute already exists");
            } else {
                throw e;
            }
        }

        console.log("\n✓ All attributes are ready!");
    } catch (error) {
        console.error("✗ Error:", error.message);
    }
}

addSizeAttribute();
