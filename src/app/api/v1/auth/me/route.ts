import { NextResponse, NextRequest, connection } from "next/server";
import { getAppwriteAccount } from "@/lib/appwrite";
import { isPostgresBackend } from "@/backend/config";
import { getPostgresAuthHttp } from "../http";

export async function GET(request: NextRequest) {
  if (isPostgresBackend()) {
    return getPostgresAuthHttp().mePostgres(request);
  }

  await connection();
  try {
    // Create account instance with the session (handled automatically)
    const account = await getAppwriteAccount();

    // Get current user
    const user = await account.get();

    // Generate a JWT for the client to use with the Browser SDK
    const jwtResponse = await account.createJWT();
    const jwt = jwtResponse.jwt;

    return NextResponse.json({
      success: true,
      user: {
        id: user.$id,
        email: user.email,
        name: user.name,
        emailVerification: user.emailVerification,
      },
      jwt,
    });
  } catch (error: unknown) {
    console.error("Auth check error:", error);
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
