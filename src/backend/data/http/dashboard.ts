import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getDataRepositories } from "../repositories";
import { computeDashboardStats } from "../dashboard-stats";

/**
 * PostgreSQL branch for GET /api/v1/dashboard/stats. Response shape mirrors the
 * legacy Appwrite handler; the numbers are computed with the same rules.
 */
export async function dashboardStatsPostgres(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const repos = getDataRepositories();
    const templates = await repos.templates.list({ ownerId: user.id, limit: 1 });
    // Stats scan up to 500 recent documents including trashed ones, like the
    // legacy route that listed every document for the user.
    const documents = await repos.documents.listForStats(user.id, 500);

    const templateTitles: Record<string, string> = {};
    await Promise.all(
      documents.slice(0, 5).map(async (doc) => {
        const template = await repos.templates.getById(doc.template_id);
        if (template) {
          templateTitles[doc.template_id] = template.title;
        }
      }),
    );

    const result = computeDashboardStats({
      templatesCount: templates.total,
      documents,
      templateTitles,
    });

    return NextResponse.json({
      success: true,
      stats: result.stats,
      activityData: result.activityData,
      recentDocuments: result.recentDocuments,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch dashboard stats";
    console.error("Dashboard stats error:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
