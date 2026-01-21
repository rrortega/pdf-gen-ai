import {
    Client,
    Account,
    Databases,
    Permission,
    Role,
    ID,
} from "appwrite";

// Browser SDK client (for client-side operations with session)
export const getAppwriteClient = (sessionSecret?: string) => {
    const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

    if (sessionSecret) {
        client.setSession(sessionSecret);
    }
    return client;
};

let clientSideClient: Client | null = null;

// Client-safe version without cookies (for use in client components)
export const getAppwriteClientSafe = () => {
    if (!clientSideClient) {
        clientSideClient = new Client()
            .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
            .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);
    }
    return clientSideClient;
};

export { Account, Databases, Permission, Role, ID };
