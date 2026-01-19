import { NextRequest, NextResponse } from "next/server";
import { getAppwriteAccount } from "@/lib/appwrite";

export async function GET(request: NextRequest) {
  console.log("=== DIAGNOSTIC START ===");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Request URL:", request.url);
  console.log("User Agent:", request.headers.get("user-agent"));

  // Check environment variables
  console.log("Environment Variables:");
  console.log(
    "- NEXT_PUBLIC_APPWRITE_ENDPOINT:",
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
  );
  console.log(
    "- NEXT_PUBLIC_APPWRITE_PROJECT_ID:",
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
  );
  console.log("- APPWRITE_API_KEY exists:", !!process.env.APPWRITE_API_KEY);
  console.log(
    "- APPWRITE_API_KEY length:",
    process.env.APPWRITE_API_KEY?.length,
  );

  // Test Appwrite connection
  try {
    console.log("Testing Appwrite connection...");
    const account = await getAppwriteAccount();

    // Try to get health (this should work even without auth)
    console.log("Appwrite client created successfully");

    // Try to get current user (this will fail if not authenticated)
    try {
      const user = await account.get();
      console.log("✅ User authenticated:", user.email);
    } catch (userError: any) {
      console.log("ℹ️  User not authenticated (expected):", userError.message);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Appwrite connection failed";
    console.log("❌ Appwrite connection failed:", errorMessage);
  }

  console.log("=== DIAGNOSTIC END ===");

  return NextResponse.json({
    status: "diagnostic completed",
    timestamp: new Date().toISOString(),
    server_running: true,
    environment_loaded: !!process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
  });
}
