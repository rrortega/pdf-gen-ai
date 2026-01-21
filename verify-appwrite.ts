
import * as sdk from "node-appwrite";
import * as dotenv from "dotenv";
dotenv.config();

const client = new sdk.Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "")
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "")
    .setKey(process.env.APPWRITE_API_KEY || "");

const databases = new sdk.Databases(client);
const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "";

async function verify() {
    console.log("Database ID:", databaseId);
    try {
        const collections = await databases.listCollections(databaseId);
        console.log("Collections found:", collections.total);
        collections.collections.forEach(c => {
            console.log(`- Name: ${c.name}, ID: ${c.$id}`);
        });
    } catch (e: any) {
        console.error("Error listing collections:", e.message);
    }
}

verify();
