import { NextRequest, NextResponse } from "next/server";
import { getAppwriteAccount } from "@/lib/appwrite";

export async function POST(request: NextRequest) {
  try {
    // Create account instance with the session (handled automatically)
    const account = await getAppwriteAccount();

    if (account) {
      // Delete current session
      await account.deleteSession("current");
    }

    // Create response and clear the session cookie
    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });

    response.cookies.set('session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error: unknown) {
    console.error("Logout error:", error);

    // Even if there's an error, clear the cookie
    const response = NextResponse.json(
      { error: error instanceof Error ? error.message : "Logout failed" },
      { status: 500 },
    );

    response.cookies.set('session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  }
}
