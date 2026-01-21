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

// Constants
export const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "default";
export const COLLECTIONS = {
  TEMPLATES: process.env.NEXT_PUBLIC_APPWRITE_TEMPLATES_COLLECTION_ID || "templates",
  DOCUMENTS: process.env.NEXT_PUBLIC_APPWRITE_DOCUMENTS_COLLECTION_ID || "documents",
  OAUTH_CODES: process.env.OAUTH_CODES_COLLECTION_ID || "oauth_codes"
} as const;

export const BUCKETS = {
  PDFS: "pdfs",
  PREVIEWS: "previews",
} as const;

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

export const getSessionSecret = async () => {
  const cookieStore = await cookies();
  return cookieStore.get("session")?.value;
};

export const getAppwriteAccount = async (sessionSecret?: string) => {
  if (sessionSecret) {
    return new Account(getAppwriteClient(sessionSecret));
  }
  const secret = await getSessionSecret();
  return new Account(getAppwriteClient(secret));
};

export const getAppwriteDatabases = async (sessionSecret?: string) => {
  if (sessionSecret) {
    return new Databases(getAppwriteClient(sessionSecret));
  }
  const secret = await getSessionSecret();
  return new Databases(getAppwriteClient(secret));
};

export const getAppwriteStorage = async (sessionSecret?: string) => {
  if (sessionSecret) {
    return new Storage(getAppwriteClient(sessionSecret));
  }
  const secret = await getSessionSecret();
  return new Storage(getAppwriteClient(secret));
};

// Server SDK client (for server-side operations with API key)
export const getServerAppwriteClient = () => {
  const client = new sdk.Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
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

export const getServerAppwriteUsers = () => {
  return new sdk.Users(getServerAppwriteClient());
};

export { Permission, Role, ID };
