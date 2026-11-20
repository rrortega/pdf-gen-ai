import { NextResponse } from "next/server";
import * as sdk from "node-appwrite";
import {
  DATABASE_ID,
  COLLECTIONS,
  BUCKETS,
} from "@/lib/appwrite";
import { isPostgresBackend } from "@/backend/config";
import { setupPostgres } from "@/backend/data/http/setup";

export async function POST() {
  if (isPostgresBackend()) {
    return setupPostgres();
  }

  try {
    const client = new sdk.Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);

    const tables = new sdk.TablesDB(client);
    const storage = new sdk.Storage(client);

    console.log("Setting up Appwrite database...");

    // Create Templates Collection
    try {
      await tables.createTable({
        databaseId: DATABASE_ID,
        tableId: COLLECTIONS.TEMPLATES,
        name: "Templates",
        permissions: [
          sdk.Permission.read(sdk.Role.users()),
          sdk.Permission.write(sdk.Role.users()),
          sdk.Permission.delete(sdk.Role.users()),
        ],
      });

      // Create template columns
      await tables.createStringColumn({
        databaseId: DATABASE_ID,
        tableId: COLLECTIONS.TEMPLATES,
        key: "title",
        size: 255,
        required: true,
      });

      await tables.createStringColumn({
        databaseId: DATABASE_ID,
        tableId: COLLECTIONS.TEMPLATES,
        key: "description",
        size: 1000,
        required: false,
      });

      await tables.createStringColumn({
        databaseId: DATABASE_ID,
        tableId: COLLECTIONS.TEMPLATES,
        key: "html",
        size: 50000,
        required: true,
      });

      await tables.createStringColumn({
        databaseId: DATABASE_ID,
        tableId: COLLECTIONS.TEMPLATES,
        key: "css",
        size: 20000,
        required: false,
      });

      await tables.createStringColumn({
        databaseId: DATABASE_ID,
        tableId: COLLECTIONS.TEMPLATES,
        key: "preview_image",
        size: 255,
        required: false,
      });

      await tables.createStringColumn({
        databaseId: DATABASE_ID,
        tableId: COLLECTIONS.TEMPLATES,
        key: "user_id",
        size: 255,
        required: true,
      });

      await tables.createStringColumn({
        databaseId: DATABASE_ID,
        tableId: COLLECTIONS.TEMPLATES,
        key: "test_data", // Field for test data (base64)
        size: 10000,
        required: false,
      });

      console.log("Templates table created");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.log("Templates table might already exist:", message);
    }

    // Create Documents Collection
    try {
      await tables.createTable({
        databaseId: DATABASE_ID,
        tableId: COLLECTIONS.DOCUMENTS,
        name: "Documents",
        permissions: [
          sdk.Permission.read(sdk.Role.users()),
          sdk.Permission.write(sdk.Role.users()),
          sdk.Permission.delete(sdk.Role.users()),
        ],
      });

      // Create document columns
      await tables.createStringColumn({
        databaseId: DATABASE_ID,
        tableId: COLLECTIONS.DOCUMENTS,
        key: "template_id",
        size: 255,
        required: true,
      });

      await tables.createStringColumn({
        databaseId: DATABASE_ID,
        tableId: COLLECTIONS.DOCUMENTS,
        key: "name",
        size: 255,
        required: true,
      });

      await tables.createStringColumn({
        databaseId: DATABASE_ID,
        tableId: COLLECTIONS.DOCUMENTS,
        key: "pdf_file",
        size: 255,
        required: false, // Changed to false as it might not be there initially
      });

      await tables.createStringColumn({
        databaseId: DATABASE_ID,
        tableId: COLLECTIONS.DOCUMENTS,
        key: "user_id",
        size: 255,
        required: true,
      });

      await tables.createEnumColumn({
        databaseId: DATABASE_ID,
        tableId: COLLECTIONS.DOCUMENTS,
        key: "status",
        elements: ["pending", "completed", "failed"],
        required: true,
        xdefault: "pending",
      });

      await tables.createStringColumn({
        databaseId: DATABASE_ID,
        tableId: COLLECTIONS.DOCUMENTS,
        key: "error_message",
        size: 1000,
        required: false,
      });

      await tables.createStringColumn({
        databaseId: DATABASE_ID,
        tableId: COLLECTIONS.DOCUMENTS,
        key: "data", // Field for JSON data (base64)
        size: 20000,
        required: false,
      });

      await tables.createIntegerColumn({
        databaseId: DATABASE_ID,
        tableId: COLLECTIONS.DOCUMENTS,
        key: "size",
        required: false,
        xdefault: 0,
      });

      await tables.createIntegerColumn({
        databaseId: DATABASE_ID,
        tableId: COLLECTIONS.DOCUMENTS,
        key: "downloads",
        required: false,
        xdefault: 0,
      });

      console.log("Documents table created");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.log("Documents table might already exist:", message);
    }

    // Create OAuth Tokens Collection
    try {
      await tables.createTable({
        databaseId: DATABASE_ID,
        tableId: "oauth_tokens",
        name: "OAuth Tokens",
        permissions: [
          sdk.Permission.read(sdk.Role.users()),
          sdk.Permission.write(sdk.Role.users()),
          sdk.Permission.delete(sdk.Role.users()),
        ],
      });

      await tables.createStringColumn({ databaseId: DATABASE_ID, tableId: "oauth_tokens", key: "client_id", size: 255, required: true });
      await tables.createStringColumn({ databaseId: DATABASE_ID, tableId: "oauth_tokens", key: "user_id", size: 255, required: true });
      await tables.createStringColumn({ databaseId: DATABASE_ID, tableId: "oauth_tokens", key: "access_token", size: 1000, required: true });
      await tables.createStringColumn({ databaseId: DATABASE_ID, tableId: "oauth_tokens", key: "refresh_token", size: 1000, required: false });
      await tables.createStringColumn({ databaseId: DATABASE_ID, tableId: "oauth_tokens", key: "token_type", size: 50, required: true });
      await tables.createStringColumn({ databaseId: DATABASE_ID, tableId: "oauth_tokens", key: "expires_at", size: 50, required: true });
      await tables.createStringColumn({ databaseId: DATABASE_ID, tableId: "oauth_tokens", key: "scopes", size: 255, required: true, array: true });
      await tables.createStringColumn({ databaseId: DATABASE_ID, tableId: "oauth_tokens", key: "created_at", size: 50, required: true });

      console.log("OAuth Tokens table created");
    } catch {
      console.log("OAuth Tokens table might already exist");
    }

    // Create OAuth Codes Collection
    try {
      await tables.createTable({
        databaseId: DATABASE_ID,
        tableId: "oauth_codes",
        name: "OAuth Codes",
        permissions: [
          sdk.Permission.read(sdk.Role.users()),
          sdk.Permission.write(sdk.Role.users()),
          sdk.Permission.delete(sdk.Role.users()),
        ],
      });

      await tables.createStringColumn({ databaseId: DATABASE_ID, tableId: "oauth_codes", key: "code", size: 255, required: true });
      await tables.createStringColumn({ databaseId: DATABASE_ID, tableId: "oauth_codes", key: "client_id", size: 255, required: true });
      await tables.createStringColumn({ databaseId: DATABASE_ID, tableId: "oauth_codes", key: "user_id", size: 255, required: true });
      await tables.createStringColumn({ databaseId: DATABASE_ID, tableId: "oauth_codes", key: "redirect_uri", size: 500, required: true });
      await tables.createStringColumn({ databaseId: DATABASE_ID, tableId: "oauth_codes", key: "scopes", size: 255, required: true, array: true });
      await tables.createStringColumn({ databaseId: DATABASE_ID, tableId: "oauth_codes", key: "code_challenge", size: 255, required: false });
      await tables.createStringColumn({ databaseId: DATABASE_ID, tableId: "oauth_codes", key: "code_challenge_method", size: 50, required: false });
      await tables.createStringColumn({ databaseId: DATABASE_ID, tableId: "oauth_codes", key: "expires_at", size: 50, required: true });
      await tables.createStringColumn({ databaseId: DATABASE_ID, tableId: "oauth_codes", key: "created_at", size: 50, required: true });

      console.log("OAuth Codes table created");
    } catch {
      console.log("OAuth Codes table might already exist");
    }

    // Create Buckets
    try {
      await storage.createBucket({
        bucketId: BUCKETS.PDFS,
        name: "PDFs",
        permissions: [
          sdk.Permission.read(sdk.Role.users()),
          sdk.Permission.write(sdk.Role.users()),
          sdk.Permission.delete(sdk.Role.users()),
        ],
        fileSecurity: false,
        enabled: true,
        maximumFileSize: 10 * 1024 * 1024, // 10MB
        allowedFileExtensions: ["pdf"],
        compression: sdk.Compression.Gzip,
        encryption: false,
        antivirus: false,
      });
      console.log("PDFs bucket created");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.log("PDFs bucket might already exist:", message);
    }

    try {
      await storage.createBucket({
        bucketId: BUCKETS.PREVIEWS,
        name: "Previews",
        permissions: [
          sdk.Permission.read(sdk.Role.users()),
          sdk.Permission.write(sdk.Role.users()),
          sdk.Permission.delete(sdk.Role.users()),
        ],
        fileSecurity: false,
        enabled: true,
        maximumFileSize: 5 * 1024 * 1024, // 5MB
        allowedFileExtensions: ["jpg", "jpeg", "png", "webp"],
        compression: sdk.Compression.Gzip,
        encryption: false,
        antivirus: false,
      });
      console.log("Previews bucket created");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.log("Previews bucket might already exist:", message);
    }

    return NextResponse.json({
      success: true,
      message: "Database setup completed successfully",
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: "Failed to setup database" },
      { status: 500 },
    );
  }
}
