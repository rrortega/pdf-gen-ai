import { NextResponse } from "next/server";

export async function GET() {
  console.log("=== Environment Variables Check ===");
  console.log(
    "NEXT_PUBLIC_APPWRITE_ENDPOINT:",
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
  );
  console.log(
    "NEXT_PUBLIC_APPWRITE_PROJECT_ID:",
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
  );
  console.log(
    "NEXT_PUBLIC_APPWRITE_DATABASE_ID:",
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
  );
  console.log(
    "APPWRITE_API_KEY length:",
    process.env.APPWRITE_API_KEY?.length || 0,
  );
  console.log("PDF_GENERATION_MODE:", process.env.PDF_GENERATION_MODE);
  console.log("=====================================");

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    env: {
      NEXT_PUBLIC_APPWRITE_ENDPOINT: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
      NEXT_PUBLIC_APPWRITE_PROJECT_ID:
        process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
      NEXT_PUBLIC_APPWRITE_DATABASE_ID:
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_API_KEY: process.env.APPWRITE_API_KEY
        ? "Set (length: " + process.env.APPWRITE_API_KEY.length + ")"
        : "Not set",
      PDF_GENERATION_MODE: process.env.PDF_GENERATION_MODE,
      NODE_ENV: process.env.NODE_ENV,
    },
  });
}
