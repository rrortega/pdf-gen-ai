import { NextRequest, NextResponse, connection } from "next/server";
import {
  DATABASE_ID,
  COLLECTIONS,
} from "@/lib/appwrite";
import { Query } from "node-appwrite";
import { getAuthenticatedDatabases } from "@/lib/auth";


export async function GET(request: NextRequest) {
  await connection();
  try {
    const auth = await getAuthenticatedDatabases(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tables, user } = auth;

    // Get pagination parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    // Change default limit to 10 as requested by user
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    // Get documents for current user with pagination
    // Ensure orderDesc("$createdAt") is always applied
    const response = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId: COLLECTIONS.DOCUMENTS,
      queries: [
        Query.equal("user_id", user.id),
        Query.notEqual("status", "trashed"),
        Query.orderDesc("$createdAt"),
        Query.limit(limit),
        Query.offset(offset),
      ]
    });

    // Decode data from base64
    const decodedRows = (response.rows || []).map((row: Record<string, unknown>) => {
      if (row.data && typeof row.data === 'string') {
        try {
          const decoded = Buffer.from(row.data, 'base64').toString('utf8');
          row.data = JSON.parse(decoded);
        } catch (e) {
          console.warn("Could not decode data for row:", row.$id, e);
        }
      }
      return row;
    });

    return NextResponse.json({
      success: true,
      documents: decodedRows,
      total: response.total,
      page,
      limit
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to list documents";
    console.error("List documents error:", error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}
