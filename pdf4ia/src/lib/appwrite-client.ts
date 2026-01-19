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
        .setEndpoint("https://aw.chamba.pro/v1")
        .setProject("6967f2f7001ae2212a9b");

    if (sessionSecret) {
        client.setSession(sessionSecret);
    }
    return client;
};

// Client-safe version without cookies (for use in client components)
export const getAppwriteClientSafe = () => {
    return new Client()
        .setEndpoint("https://aw.chamba.pro/v1")
        .setProject("6967f2f7001ae2212a9b");
};

export { Permission, Role, ID };
