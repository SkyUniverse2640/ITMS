export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getImportTemplateCsv,
  getImportTemplateFilename,
  type TemplateKind,
} from "@/lib/parse-spreadsheet";

const KINDS = new Set<TemplateKind>(["user", "department", "asset"]);

/**
 * GET /api/templates/:kind
 * Streams CSV import templates that match DB / import API columns.
 * SuperAdmin (and any authenticated user for flexibility).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ kind: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { kind: raw } = await params;
  const kind = raw?.toLowerCase() as TemplateKind;
  if (!KINDS.has(kind)) {
    return NextResponse.json(
      { success: false, error: "Unknown template. Use user | department | asset" },
      { status: 404 }
    );
  }

  const csv = getImportTemplateCsv(kind);
  const filename = getImportTemplateFilename(kind);

  // UTF-8 BOM helps Excel open special characters correctly
  const body = `\uFEFF${csv}`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
