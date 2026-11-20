import { NextRequest, NextResponse } from "next/server";
import { getServerAppwriteAccount, getAppwriteAccount } from "@/lib/appwrite";
import { isPostgresBackend } from "@/backend/config";
import { getPostgresAuthHttp } from "../http";

export async function POST(request: NextRequest) {
  if (isPostgresBackend()) {
    return getPostgresAuthHttp().loginPostgres(request);
  }

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    // Use server-side Account with API key for creating session
    const account = getServerAppwriteAccount();

    // Create session
    const session = await account.createEmailPasswordSession(email, password);

    // Get user info using the new session
    const accountWithSession = await getAppwriteAccount(session.secret);
    const user = await accountWithSession.get();

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      session: {
        id: session.$id,
        userId: session.userId,
        provider: session.provider,
      },
      user: {
        id: user.$id,
        email: user.email,
        name: user.name,
        emailVerification: user.emailVerification,
      },
    });

    // Set the session cookie
    response.cookies.set("session", session.secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Login failed";
    console.error("Login error:", error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 401 },
    );
  }
}
