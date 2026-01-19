import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const cookies = request.cookies.getAll();
  const headers = Object.fromEntries(request.headers.entries());

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    url: request.url,
    method: request.method,
    cookies: cookies.map((c) => ({
      name: c.name,
      value: c.value.substring(0, 20) + "...",
    })),
    headers: {
      "user-agent": headers["user-agent"],
      cookie: headers["cookie"] ? "Present" : "Not present",
      host: headers["host"],
      accept: headers["accept"],
    },
    env: {
      NODE_ENV: process.env.NODE_ENV,
      APPWRITE_ENDPOINT: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
      APPWRITE_PROJECT: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
      DATABASE_ID: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    },
  });
}
