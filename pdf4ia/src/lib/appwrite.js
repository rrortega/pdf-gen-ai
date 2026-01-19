const { Client, Account } = require("appwrite");

const endpoint = "https://aw.chamba.pro/v1";
const projectId = "6967f2f7001ae2212a9b";

const client = new Client().setEndpoint(endpoint).setProject(projectId);

const account = new Account(client);

module.exports = { client, account };
