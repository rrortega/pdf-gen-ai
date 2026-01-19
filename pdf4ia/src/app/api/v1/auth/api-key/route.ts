import { NextResponse } from "next/server";
import { getAppwriteAccount } from "@/lib/appwrite";
import { SignJWT } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";
const encoder = new TextEncoder();

export async function GET() {
    try {
        const account = await getAppwriteAccount();
        await account.get();

        // Get API key from user prefs
        const prefs = await account.getPrefs();
        const apiKey = prefs.apiKey || null;

        return NextResponse.json({
            success: true,
            apiKey: apiKey
        });
    } catch (error: any) {
        console.error("Error fetching API Key:", error);
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
}

export async function POST() {
    try {
        const account = await getAppwriteAccount();
        const user = await account.get();

        // Generate new JWT
        const secret = encoder.encode(JWT_SECRET);
        const apiKey = await new SignJWT({
            userId: user.$id,
            email: user.email
        })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .sign(secret);

        // Save to user prefs
        await account.updatePrefs({
            ...((await account.getPrefs()) || {}),
            apiKey: apiKey
        });

        return NextResponse.json({
            success: true,
            apiKey: apiKey
        });
    } catch (error: any) {
        console.error("Error generating API Key:", error);
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
}
