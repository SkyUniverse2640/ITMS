export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

/** Columns each source may be grouped by. */
const GROUPABLE: Record<string, Set<string>> = {
  tickets: new Set([
    "status",
    "priority",
    "impact",
    "urgency",
    "requestType",
    "department",
    "group",
    "category",
    "subCategory",
    "project",
  ]),
  assets: new Set(["assetCategory", "assetType", "currentState", "department", "vendor"]),
  tasks: new Set(["status", "priority"]),
  purchases: new Set(["status", "vendor", "linkedAssetType"]),
};

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const source = url.searchParams.get("source") || "tickets";
  const groupBy = url.searchParams.get("groupBy") || "status";
  const dateRange = url.searchParams.get("dateRange") || "30";

  const allowed = GROUPABLE[source];
  if (!allowed) {
    return NextResponse.json({ success: false, error: "Unknown source" }, { status: 400 });
  }
  if (!allowed.has(groupBy)) {
    return NextResponse.json(
      { success: false, error: `Cannot group ${source} by "${groupBy}"` },
      { status: 400 }
    );
  }

  const parsedDays = parseInt(dateRange);
  const dateFilter = new Date();
  dateFilter.setDate(dateFilter.getDate() - (Number.isFinite(parsedDays) ? parsedDays : 30));

  // groupBy is typed per model against a literal column name, so it is
  // dispatched per source with the column asserted — it was already validated
  // against that source's allowlist above.
  const since = { createdAt: { gte: dateFilter } };
  const rows = await (source === "tickets"
    ? prisma.ticket.groupBy({
        by: [groupBy as "status"],
        where: since,
        _count: { _all: true },
      })
    : source === "assets"
      ? prisma.asset.groupBy({
          by: [groupBy as "currentState"],
          _count: { _all: true },
        })
      : source === "tasks"
        ? prisma.task.groupBy({
            by: [groupBy as "status"],
            where: since,
            _count: { _all: true },
          })
        : prisma.purchase.groupBy({
            by: [groupBy as "status"],
            where: since,
            _count: { _all: true },
          }));

  const data: Record<string, number> = {};
  for (const row of rows as ({ _count: { _all: number } } & Record<string, unknown>)[]) {
    const key = (row[groupBy] as string) || "Unknown";
    data[key] = (data[key] || 0) + row._count._all;
  }

  return NextResponse.json({ success: true, data });
}
