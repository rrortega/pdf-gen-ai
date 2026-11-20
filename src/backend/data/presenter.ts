import type { DocumentRow, TemplateRow } from "../data-contracts";

/**
 * Response shaping shared by the postgres route branches. Field names mirror
 * the legacy Appwrite route responses exactly; internal columns never leak.
 */

function decodeBase64Json(value: string | null | undefined): unknown {
  if (!value || typeof value !== "string") {
    return value ?? undefined;
  }
  try {
    return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
  } catch {
    // Legacy behaviour: keep the raw stored value when it cannot be decoded.
    return value;
  }
}

export function toTemplateListItem(row: TemplateRow, includeTestData: boolean) {
  const item: Record<string, unknown> = {
    $id: row.$id,
    title: row.title,
    description: row.description,
    tags: row.tags,
    $createdAt: row.$createdAt,
    $updatedAt: row.$updatedAt,
  };

  if (includeTestData && row.test_data) {
    const decoded = decodeBase64Json(row.test_data);
    if (decoded !== undefined) {
      item.request_payload = decoded;
    }
  }

  return item;
}

export function toTemplateDetail(row: TemplateRow) {
  return {
    $id: row.$id,
    $createdAt: row.$createdAt,
    $updatedAt: row.$updatedAt,
    title: row.title || "",
    tags: row.tags || [],
    css: row.css || "",
    html: row.html || "",
    test_data: row.test_data ? decodeBase64Json(row.test_data) : "{}",
    orientation: row.orientation || "portrait",
    paperSize: row.paper_size || "A4",
    margins: {
      top: row.margin_top || "10mm",
      right: row.margin_right || "10mm",
      bottom: row.margin_bottom || "10mm",
      left: row.margin_left || "10mm",
    },
  };
}

export function toTemplateUpdateResponse(row: TemplateRow) {
  return {
    $id: row.$id,
    $createdAt: row.$createdAt,
    $updatedAt: row.$updatedAt,
    title: row.title,
    tags: row.tags || [],
    css: row.css,
    html: row.html,
    test_data: row.test_data ? decodeBase64Json(row.test_data) : row.test_data,
    orientation: row.orientation,
    paperSize: row.paper_size,
    margins: {
      top: row.margin_top,
      right: row.margin_right,
      bottom: row.margin_bottom,
      left: row.margin_left,
    },
  };
}

export function toDocumentListRow(row: DocumentRow) {
  const shaped: Record<string, unknown> = { ...row };
  if (row.data && typeof row.data === "string") {
    shaped.data = decodeBase64Json(row.data);
  }
  return shaped;
}
