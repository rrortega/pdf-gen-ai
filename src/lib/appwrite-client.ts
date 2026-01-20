import {
    Client,
    Account,
    Databases,
    Storage,
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

// Client-safe version without cookies (for use in client components)
export const getAppwriteClientSafe = () => {
    return new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);
};

export { Permission, Role, ID };
