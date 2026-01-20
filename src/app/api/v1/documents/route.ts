import { NextRequest, NextResponse } from "next/server";
import {
  DATABASE_ID,
  COLLECTIONS,
} from "@/lib/appwrite";
import { Query } from "node-appwrite";
import { getAuthenticatedDatabases } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedDatabases(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tables, user } = auth;

    // Get documents for current user
    const response = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId: COLLECTIONS.DOCUMENTS,
      queries: [
        Query.equal("user_id", user.id),
        Query.orderDesc("$createdAt"),
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
