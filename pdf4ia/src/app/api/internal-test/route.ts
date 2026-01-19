import { NextResponse } from "next/server";
import { getAppwriteAccount } from "@/lib/appwrite";

export async function GET() {
  const results: {
    timestamp: string;
    server: any;
    environment: any;
    appwrite: {
      status: string;
      error: string | null;
      user?: {
        id: string;
        email: string;
        name: string;
      };
    };
  } = {
    timestamp: new Date().toISOString(),
    server: {
      status: "running",
      nodeVersion: process.version,
      platform: process.platform,
    },
    environment: {
      NEXT_PUBLIC_APPWRITE_ENDPOINT: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
      NEXT_PUBLIC_APPWRITE_PROJECT_ID:
        process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
      NEXT_PUBLIC_APPWRITE_DATABASE_ID:
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_API_KEY: process.env.APPWRITE_API_KEY
        ? `Set (${process.env.APPWRITE_API_KEY.length} chars)`
        : "Not set",
      PDF_GENERATION_MODE: process.env.PDF_GENERATION_MODE,
      NODE_ENV: process.env.NODE_ENV,
    },
    appwrite: {
      status: "unknown",
      error: null,
    },
  };

  // Test Appwrite connection
  try {
    console.log("🔍 Testing Appwrite connection...");
    const account = await getAppwriteAccount();

    // Try to get current user (will fail if not authenticated)
    try {
      const user = await account.get();
      results.appwrite = {
        status: "authenticated",
        error: null,
        user: {
          id: user.$id,
          email: user.email,
          name: user.name,
        },
      };
      console.log("✅ Appwrite authenticated:", user.email);
    } catch (authError: any) {
      results.appwrite = {
        status: "not_authenticated",
        error: authError.message,
      };
      console.log(
        "ℹ️  Appwrite not authenticated (expected):",
        authError.message,
      );
    }
  } catch (error: any) {
    results.appwrite = {
      status: "connection_failed",
      error: error.message,
    };
    console.log("❌ Appwrite connection failed:", error.message);
  }

  console.log("📊 Internal test results:", JSON.stringify(results, null, 2));

  return NextResponse.json(results);
}
