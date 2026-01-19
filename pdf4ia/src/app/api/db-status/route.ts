import { NextResponse } from "next/server";
import { getServerAppwriteClient } from "@/lib/appwrite";
import { TablesDB, Storage } from "node-appwrite";

export async function GET() {
  try {
    const client = getServerAppwriteClient();
    const tables = new TablesDB(client);
    const storage = new Storage(client);

    const databaseId = "6968108e00298587f520";

    const status: {
      timestamp: string;
      appwrite_connection: boolean;
      database: { id: string; name: string } | null;
      collections: { id: string; name: string; enabled: boolean }[];
      buckets: { id: string; name: string; fileCount: number }[];
      errors: string[];
    } = {
      timestamp: new Date().toISOString(),
      appwrite_connection: false,
      database: null,
      collections: [],
      buckets: [],
      errors: [],
    };

    try {
      // Test connection
      status.appwrite_connection = true;

      // Check database
      try {
        const db = await tables.get({
          databaseId: databaseId
        });
        status.database = {
          id: db.$id,
          name: db.name,
        };
      } catch (dbError: unknown) {
        const msg = dbError instanceof Error ? dbError.message : String(dbError);
        status.errors.push(`Database check failed: ${msg}`);
      }

      try {
        const response = await tables.listTables({
          databaseId: databaseId
        });
        status.collections = response.tables.map((t) => ({
          id: t.$id,
          name: t.name,
          enabled: t.enabled,
        }));
      } catch (collError: unknown) {
        const msg = collError instanceof Error ? collError.message : String(collError);
        status.errors.push(`Tables check failed: ${msg}`);
      }

      // Check buckets
      try {
        const buckets = await storage.listBuckets();
        status.buckets = buckets.buckets.map((b: any) => ({
          id: b.$id,
          name: b.name,
          fileCount: b.fileCount || 0,
        }));
      } catch (bucketError: unknown) {
        const msg = bucketError instanceof Error ? bucketError.message : String(bucketError);
        status.errors.push(`Buckets check failed: ${msg}`);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      status.errors.push(`Connection failed: ${msg}`);
      status.appwrite_connection = false;
    }

    return NextResponse.json(status);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        error: msg,
        appwrite_connection: false,
      },
      { status: 500 },
    );
  }
}
