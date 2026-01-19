import { NextRequest, NextResponse } from "next/server";
import { getAppwriteAccount } from "@/lib/appwrite";

export async function GET(_request: NextRequest) {
  try {
    console.log("Testing Appwrite connection...");

    // Test basic connection without authentication
    const account = await getAppwriteAccount();

    // Try to get current user (should fail gracefully)
    try {
      const user = await account.get();
      return NextResponse.json({
        success: true,
        message: "Appwrite connection successful",
        user: {
          id: user.$id,
          email: user.email,
          name: user.name,
        },
      });
    } catch (userError: any) {
      console.log(
        "User not authenticated (this is expected):",
        userError.message,
      );
      return NextResponse.json({
        success: true,
        message: "Appwrite connection successful, but user not authenticated",
        error: userError.message,
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Appwrite test failed";
    console.error("Appwrite test failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: "Check your Appwrite configuration and API keys",
      },
      { status: 500 },
    );
  }
}
