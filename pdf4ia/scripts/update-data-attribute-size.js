const { Client, Databases } = require('node-appwrite');

const client = new Client()
    .setEndpoint("https://aw.chamba.pro/v1")
    .setProject("6967f2f7001ae2212a9b")
    .setKey(process.env.APPWRITE_API_KEY || "standard_26c82b29266f1de3aa69c8c660dcaf3b734029eb4316a4de3614d9f53696676829fc339cbc44407b3f13f5dd4469905ee81db59847d7c73539bb9ad5b1060e162897674a7e5f34bb52919a0c07a9d82e7fdb11f5a03e63099ab289d5b1480a158e420d8a778d723009e441875489e73e42e410c56b5664ea35fd5c8ab502633e");

const databases = new Databases(client);
const DATABASE_ID = "6968108e00298587f520";
const COLLECTION_ID = "documents";

async function updateAttributeSize() {
    try {
        console.log("Updating 'data' attribute size in 'documents' collection...");

        await databases.updateStringAttribute(
            DATABASE_ID,
            COLLECTION_ID,
            "data",
            false,    // required
            null,     // xdefault
            5000000   // size
        );

        console.log("Successfully updated 'data' attribute size to 5,000,000 characters.");
    } catch (error) {
        console.error("Error updating attribute size:", error.message);
        if (error.response) {
            console.error("Details:", JSON.stringify(error.response, null, 2));
        }
    }
}

updateAttributeSize();
