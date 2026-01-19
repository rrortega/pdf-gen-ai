import {
  Client,
  Account,
  Databases,
  Storage,
  Permission,
  Role,
  ID,
} from "appwrite";
import * as sdk from "node-appwrite";
import { cookies } from "next/headers";

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

export const getSessionSecret = async () => {
  const cookieStore = await cookies();
  return cookieStore.get("session")?.value;
};

export const getAppwriteAccount = async (sessionSecret?: string) => {
  const secret = sessionSecret || (await getSessionSecret());
  return new Account(getAppwriteClient(secret));
};

export const getAppwriteDatabases = async (sessionSecret?: string) => {
  const secret = sessionSecret || (await getSessionSecret());
  return new Databases(getAppwriteClient(secret));
};

export const getAppwriteStorage = async (sessionSecret?: string) => {
  const secret = sessionSecret || (await getSessionSecret());
  return new Storage(getAppwriteClient(secret));
};

// Server SDK client (for server-side operations with API key)
export const getServerAppwriteClient = () => {
  const client = new sdk.Client()
    .setEndpoint("https://aw.chamba.pro/v1")
    .setProject("6967f2f7001ae2212a9b")
    .setKey(process.env.APPWRITE_API_KEY!);

  return client;
};

export const getServerAppwriteAccount = () => {
  return new sdk.Account(getServerAppwriteClient());
};
/**
 * @deprecated use getServerAppwriteTables
 */
export const getServerAppwriteDatabases = () => {
  return new sdk.Databases(getServerAppwriteClient());
};

export const getServerAppwriteTables = () => {
  return new sdk.TablesDB(getServerAppwriteClient());
};

export const getServerAppwriteStorage = () => {
  return new sdk.Storage(getServerAppwriteClient());
};

export const getServerAppwriteAvatars = () => {
  return new sdk.Avatars(getServerAppwriteClient());
};

// Constants
export const DATABASE_ID = "6968108e00298587f520";
export const COLLECTIONS = {
  TEMPLATES: "templates",
  DOCUMENTS: "documents",
} as const;

export const BUCKETS = {
  PDFS: "pdfs",
  PREVIEWS: "previews",
} as const;

export { Permission, Role, ID };
