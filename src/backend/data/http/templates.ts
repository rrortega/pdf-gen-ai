import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { authenticateRequest } from "@/lib/auth";
import { getDataRepositories } from "../repositories";
import {
  toTemplateListItem,
  toTemplateDetail,
  toTemplateUpdateResponse,
} from "../presenter";

/**
 * PostgreSQL branches for the /api/v1/templates routes. Response shapes and
 * status codes mirror the legacy Appwrite handlers exactly.
 */

const DEFAULT_HTML = `<!-- Handlebars Template -->
<div class="document">
  <h1>{{title}}</h1>
</div>`;

const DEFAULT_CSS = `/* PDF Styles */
body {
  font-family: Arial, sans-serif;
  padding: 20px;
}`;

export function invalidateTemplateCaches(userId: string): void {
  revalidatePath("/templates", "page");
  revalidatePath("/dashboard", "page");
  revalidateTag("templates", "max");
  revalidateTag(`user-templates-${userId}`, "max");
  revalidateTag("dashboard", "max");
  revalidateTag(`user-dashboard-${userId}`, "max");
}

/** 403 when the row exists but belongs to another owner, 404 when missing. */
export function ownershipResponse(
  exists: boolean,
  notFoundMessage: string,
): NextResponse {
  if (exists) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  return NextResponse.json({ error: notFoundMessage }, { status: 404 });
}

export async function listTemplatesPostgres(request: NextRequest): Promise<NextResponse> {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search") ?? undefined;
  const tags = searchParams.get("tags")?.split(",");
  const ids = searchParams.get("ids")?.split(",");
  const includeTestData = searchParams.get("includeTestData") === "true";
  const base = searchParams.get("base") !== null;

  const { total, rows } = await getDataRepositories().templates.list({
    ownerId: user.id,
    base,
    search: search || undefined,
    tags: tags && tags.length > 0 ? tags : undefined,
    ids: ids && ids.length > 0 ? ids : undefined,
  });

  return NextResponse.json({
    success: true,
    total,
    templates: rows.map((row) => toTemplateListItem(row, includeTestData)),
  });
}

export async function createTemplatePostgres(request: NextRequest): Promise<NextResponse> {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, tags, baseTemplateId } = body;

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  let initialData = {
    title: String(title),
    tags: tags || [],
    html: DEFAULT_HTML,
    css: DEFAULT_CSS,
    test_data: Buffer.from(JSON.stringify({ title: "Sample" })).toString("base64"),
    orientation: "portrait",
    paper_size: "A4",
    margin_top: "20mm",
    margin_right: "20mm",
    margin_bottom: "20mm",
    margin_left: "20mm",
  };

  if (baseTemplateId) {
    // Legacy copies the base template content without an ownership check;
    // the system-principal read preserves that shared base-template behavior.
    try {
      const baseTemplate = await getDataRepositories().templates.getById(baseTemplateId);
      if (baseTemplate) {
        initialData = {
          ...initialData,
          html: baseTemplate.html || initialData.html,
          css: baseTemplate.css || initialData.css,
          test_data: baseTemplate.test_data || initialData.test_data,
          orientation: baseTemplate.orientation || initialData.orientation,
          paper_size: baseTemplate.paper_size || initialData.paper_size,
          margin_top: baseTemplate.margin_top || initialData.margin_top,
          margin_right: baseTemplate.margin_right || initialData.margin_right,
          margin_bottom: baseTemplate.margin_bottom || initialData.margin_bottom,
          margin_left: baseTemplate.margin_left || initialData.margin_left,
        };
      }
    } catch (error: unknown) {
      console.warn("Could not fetch base template, using defaults:", error);
    }
  }

  const created = await getDataRepositories().templates.create(user.id, initialData);

  invalidateTemplateCaches(user.id);

  return NextResponse.json({
    success: true,
    template: {
      $id: created.$id,
      $createdAt: created.$createdAt,
      title: created.title,
    },
  });
}

export async function getTemplatePostgres(
  request: NextRequest,
  id: string,
): Promise<NextResponse> {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repos = getDataRepositories();
  const template = await repos.templates.get(user.id, id);
  if (!template) {
    return ownershipResponse(await repos.templates.exists(id), "Template not found");
  }

  return NextResponse.json({
    success: true,
    template: toTemplateDetail(template),
  });
}

export async function updateTemplatePostgres(
  request: NextRequest,
  id: string,
): Promise<NextResponse> {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repos = getDataRepositories();
  const existing = await repos.templates.get(user.id, id);
  if (!existing) {
    return ownershipResponse(await repos.templates.exists(id), "Template not found");
  }

  const {
    title,
    tags,
    css,
    html,
    test_data,
    orientation,
    paperSize,
    margin_left,
    margin_top,
    margin_right,
    margin_bottom,
  } = await request.json();

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const finalHtml = html || existing.html || "";
  const finalCss = css || existing.css || "";

  let encodedSampleData = existing.test_data || "";
  if (test_data !== undefined) {
    const testDataObject = typeof test_data === "string" ? JSON.parse(test_data) : test_data;
    encodedSampleData = Buffer.from(JSON.stringify(testDataObject || {})).toString("base64");
  }

  const updated = await repos.templates.update(user.id, id, {
    title,
    tags: tags || [],
    css: finalCss,
    html: finalHtml,
    test_data: encodedSampleData,
    orientation: orientation || "portrait",
    paper_size: paperSize || "A4",
    margin_top: margin_top || "10mm",
    margin_right: margin_right || "10mm",
    margin_bottom: margin_bottom || "10mm",
    margin_left: margin_left || "10mm",
  });

  invalidateTemplateCaches(user.id);

  return NextResponse.json({
    success: true,
    template: updated ? toTemplateUpdateResponse(updated) : null,
  });
}

export async function deleteTemplatePostgres(
  request: NextRequest,
  id: string,
): Promise<NextResponse> {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repos = getDataRepositories();
  const template = await repos.templates.get(user.id, id);
  if (!template) {
    return ownershipResponse(await repos.templates.exists(id), "Template not found");
  }

  await repos.templates.delete(user.id, id);

  invalidateTemplateCaches(user.id);

  return NextResponse.json({ success: true });
}
