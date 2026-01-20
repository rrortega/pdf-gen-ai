const { Client, Account } = require("appwrite");

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

const client = new Client().setEndpoint(endpoint).setProject(projectId);

const account = new Account(client);

module.exports = { client, account };
