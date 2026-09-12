export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

/** Chart rows the UI reads as `{ _id, count }`. */
type CountRow = { _id: string; count: number };

/** Reshape a Prisma groupBy result into the chart row shape. */
function toCountRows<K extends string>(
  rows: ({ _count: { _all: number } } & Record<K, string | null>)[],
  key: K
): CountRow[] {
  return rows.map((r) => ({ _id: r[key] ?? "", count: r._count._all }));
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  // Reports contain organization-wide data — restrict to SuperAdmin and Auditors
  if (session.role !== "SuperAdmin" && !session.userTypes.includes("Auditor")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "ticket-volume";
  const days = parseInt(url.searchParams.get("days") || "30");
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - (Number.isFinite(days) ? days : 30));

  let data: unknown = null;

  switch (type) {
    case "ticket-volume": {
      const since = { createdAt: { gte: dateFrom } };
      const [byCategoryRaw, byPriorityRaw, byStatusRaw, byDay] = await Promise.all([
        prisma.ticket.groupBy({
          by: ["category"],
          where: since,
          _count: { _all: true },
          orderBy: { _count: { category: "desc" } },
        }),
        prisma.ticket.groupBy({ by: ["priority"], where: since, _count: { _all: true } }),
        prisma.ticket.groupBy({ by: ["status"], where: since, _count: { _all: true } }),
        // Day buckets have no groupBy equivalent — date_trunc in SQL instead.
        prisma.$queryRaw<{ _id: string; count: bigint }[]>`
          SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS "_id",
                 count(*) AS count
          FROM tickets
          WHERE created_at >= ${dateFrom}
          GROUP BY 1
          ORDER BY 1 ASC
        `,
      ]);
      data = {
        byCategory: toCountRows(byCategoryRaw, "category"),
        byPriority: toCountRows(byPriorityRaw, "priority"),
        byStatus: toCountRows(byStatusRaw, "status"),
        byDay: byDay.map((d) => ({ _id: d._id, count: Number(d.count) })),
      };
      break;
    }
    case "sla-compliance": {
      const [total, breached] = await Promise.all([
        prisma.ticket.count({ where: { createdAt: { gte: dateFrom } } }),
        prisma.ticket.count({ where: { createdAt: { gte: dateFrom }, slaBreached: true } }),
      ]);
      const compliance = total > 0 ? ((total - breached) / total) * 100 : 100;
      data = { total, breached, met: total - breached, compliance: Math.round(compliance * 100) / 100 };
      break;
    }
    case "resolution-time": {
      const resolved = await prisma.ticket.findMany({
        where: { resolvedAt: { not: null }, createdAt: { gte: dateFrom } },
        select: { createdAt: true, resolvedAt: true, priority: true },
      });

      const times = resolved.map((t) => ({
        priority: t.priority,
        hours: (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 3600000,
      }));

      const avg = times.length > 0 ? times.reduce((s, t) => s + t.hours, 0) / times.length : 0;
      const byPriority: Record<string, { total: number; count: number; avg: number }> = {};
      for (const t of times) {
        if (!byPriority[t.priority]) byPriority[t.priority] = { total: 0, count: 0, avg: 0 };
        byPriority[t.priority].total += t.hours;
        byPriority[t.priority].count++;
      }
      for (const k in byPriority) byPriority[k].avg = Math.round((byPriority[k].total / byPriority[k].count) * 100) / 100;

      data = { averageHours: Math.round(avg * 100) / 100, byPriority, totalResolved: resolved.length };
      break;
    }
    case "asset-inventory": {
      const [byTypeRaw, byStateRaw, byDepartmentRaw, total] = await Promise.all([
        prisma.asset.groupBy({ by: ["assetCategory"], _count: { _all: true } }),
        prisma.asset.groupBy({ by: ["currentState"], _count: { _all: true } }),
        prisma.asset.groupBy({
          by: ["department"],
          where: { department: { not: null } },
          _count: { _all: true },
          orderBy: { _count: { department: "desc" } },
        }),
        prisma.asset.count(),
      ]);
      data = {
        total,
        byType: toCountRows(byTypeRaw, "assetCategory"),
        byState: toCountRows(byStateRaw, "currentState"),
        byDepartment: toCountRows(byDepartmentRaw, "department"),
      };
      break;
    }
    case "technician-performance": {
      // Needs a join to users plus a derived rate, so one SQL statement.
      const rows = await prisma.$queryRaw<
        {
          name: string;
          total: bigint;
          resolved: bigint;
          breached: bigint;
          resolutionRate: number;
        }[]
      >`
        SELECT u.display_name AS name,
               count(*) AS total,
               count(*) FILTER (WHERE t.status IN ('Resolved', 'Closed')) AS resolved,
               count(*) FILTER (WHERE t.sla_breached) AS breached,
               CASE WHEN count(*) > 0
                    THEN (count(*) FILTER (WHERE t.status IN ('Resolved', 'Closed'))::float
                          / count(*)::float) * 100
                    ELSE 0 END AS "resolutionRate"
        FROM tickets t
        JOIN users u ON u.id = t.technician_id
        WHERE t.technician_id IS NOT NULL AND t.created_at >= ${dateFrom}
        GROUP BY u.id, u.display_name
        ORDER BY "resolutionRate" DESC
      `;
      data = rows.map((r) => ({
        name: r.name,
        total: Number(r.total),
        resolved: Number(r.resolved),
        breached: Number(r.breached),
        resolutionRate: r.resolutionRate,
      }));
      break;
    }
    case "purchase-spend": {
      const [byStatusRaw, approved] = await Promise.all([
        prisma.purchase.groupBy({
          by: ["status"],
          where: { createdAt: { gte: dateFrom } },
          _count: { _all: true },
          _sum: { estimatedCost: true },
        }),
        prisma.purchase.aggregate({
          where: {
            status: { in: ["Approved", "Completed"] },
            createdAt: { gte: dateFrom },
          },
          _sum: { estimatedCost: true },
        }),
      ]);
      data = {
        byStatus: byStatusRaw.map((r) => ({
          _id: r.status,
          count: r._count._all,
          totalCost: r._sum.estimatedCost ?? 0,
        })),
        totalApprovedSpend: approved._sum.estimatedCost ?? 0,
      };
      break;
    }
    default:
      return NextResponse.json({ success: false, error: "Unknown report type" }, { status: 400 });
  }

  return NextResponse.json({ success: true, data });
}
