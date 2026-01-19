import { NextRequest, NextResponse } from "next/server";
import { getAppwriteAccount } from "@/lib/appwrite";

export async function GET(request: NextRequest) {
  try {
    // Create account instance with the session (handled automatically)
    const account = await getAppwriteAccount();

    // Get current user
    const user = await account.get();

    return NextResponse.json({
      success: true,
      user: {
        id: user.$id,
        email: user.email,
        name: user.name,
        emailVerification: user.emailVerification,
      },
    });
  } catch (error: unknown) {
    console.error("Auth check error:", error);
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
