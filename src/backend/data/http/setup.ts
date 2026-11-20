import { NextResponse } from "next/server";
import { runPostgresDataMigrationsWithPool } from "../../postgres/migrate";

/**
 * PostgreSQL branch for POST /api/setup: runs the idempotent data migration
 * script instead of creating Appwrite collections.
 */
export async function setupPostgres(): Promise<NextResponse> {
  try {
    await runPostgresDataMigrationsWithPool();
    return NextResponse.json({
      success: true,
      message: "Database setup completed successfully",
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: "Failed to setup database" },
      { status: 500 },
    );
  }
}
