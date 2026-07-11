export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Ticket from "@/lib/models/Ticket";
import Asset from "@/lib/models/Asset";
import Purchase from "@/lib/models/Purchase";
import Task from "@/lib/models/Task";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "ticket-volume";
  const days = parseInt(url.searchParams.get("days") || "30");
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);

  let data: unknown = null;

  switch (type) {
    case "ticket-volume": {
      const byCategory = await Ticket.aggregate([
        { $match: { createdAt: { $gte: dateFrom } } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);
      const byPriority = await Ticket.aggregate([
        { $match: { createdAt: { $gte: dateFrom } } },
        { $group: { _id: "$priority", count: { $sum: 1 } } },
      ]);
      const byStatus = await Ticket.aggregate([
        { $match: { createdAt: { $gte: dateFrom } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]);
      const byDay = await Ticket.aggregate([
        { $match: { createdAt: { $gte: dateFrom } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]);
      data = { byCategory, byPriority, byStatus, byDay };
      break;
    }
    case "sla-compliance": {
      const total = await Ticket.countDocuments({ createdAt: { $gte: dateFrom } });
      const breached = await Ticket.countDocuments({ createdAt: { $gte: dateFrom }, slaBreached: true });
      const compliance = total > 0 ? ((total - breached) / total) * 100 : 100;
      data = { total, breached, met: total - breached, compliance: Math.round(compliance * 100) / 100 };
      break;
    }
    case "resolution-time": {
      const resolved = await Ticket.find({
        resolvedAt: { $exists: true },
        createdAt: { $gte: dateFrom },
      }).select("createdAt resolvedAt priority").lean();

      const times = resolved.map((t) => ({
        priority: t.priority,
        hours: (new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime()) / 3600000,
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
      const byType = await Asset.aggregate([{ $group: { _id: "$assetCategory", count: { $sum: 1 } } }]);
      const byState = await Asset.aggregate([{ $group: { _id: "$currentState", count: { $sum: 1 } } }]);
      const byDepartment = await Asset.aggregate([
        { $match: { department: { $exists: true, $ne: null } } },
        { $group: { _id: "$department", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);
      const total = await Asset.countDocuments();
      data = { total, byType, byState, byDepartment };
      break;
    }
    case "technician-performance": {
      const techPerf = await Ticket.aggregate([
        { $match: { technician: { $exists: true }, createdAt: { $gte: dateFrom } } },
        {
          $group: {
            _id: "$technician",
            total: { $sum: 1 },
            resolved: { $sum: { $cond: [{ $in: ["$status", ["Resolved", "Closed"]] }, 1, 0] } },
            breached: { $sum: { $cond: ["$slaBreached", 1, 0] } },
          },
        },
        {
          $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "tech" },
        },
        { $unwind: "$tech" },
        {
          $project: {
            name: "$tech.displayName",
            total: 1, resolved: 1, breached: 1,
            resolutionRate: { $cond: [{ $gt: ["$total", 0] }, { $multiply: [{ $divide: ["$resolved", "$total"] }, 100] }, 0] },
          },
        },
        { $sort: { resolutionRate: -1 } },
      ]);
      data = techPerf;
      break;
    }
    case "purchase-spend": {
      const byStatus = await Purchase.aggregate([
        { $match: { createdAt: { $gte: dateFrom } } },
        { $group: { _id: "$status", count: { $sum: 1 }, totalCost: { $sum: "$estimatedCost" } } },
      ]);
      const totalSpend = await Purchase.aggregate([
        { $match: { status: { $in: ["Approved", "Completed"] }, createdAt: { $gte: dateFrom } } },
        { $group: { _id: null, total: { $sum: "$estimatedCost" } } },
      ]);
      data = { byStatus, totalApprovedSpend: totalSpend[0]?.total || 0 };
      break;
    }
    default:
      return NextResponse.json({ success: false, error: "Unknown report type" }, { status: 400 });
  }

  return NextResponse.json({ success: true, data });
}
