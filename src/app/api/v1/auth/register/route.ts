import { NextRequest, NextResponse } from "next/server";
import { getServerAppwriteAccount, getAppwriteAccount, ID } from "@/lib/appwrite";
import { isPostgresBackend } from "@/backend/config";
import { getPostgresAuthHttp } from "../http";

export async function POST(request: NextRequest) {
  if (isPostgresBackend()) {
    return getPostgresAuthHttp().registerPostgres(request);
  }

  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, password and name are required" },
        { status: 400 },
      );
    }

    // Use server-side Account with API key
    const account = getServerAppwriteAccount();

    // Create user account
    const user = await account.create(
      ID.unique(),
      email,
      password,
      name,
    );

    // Create session for the new user
    const session = await account.createEmailPasswordSession(email, password);

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
    const errorMessage = error instanceof Error ? error.message : "Registration failed";
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 400 },
    );
  }
}
