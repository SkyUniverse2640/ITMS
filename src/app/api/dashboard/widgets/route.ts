export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Ticket from "@/lib/models/Ticket";
import Asset from "@/lib/models/Asset";
import Task from "@/lib/models/Task";
import Purchase from "@/lib/models/Purchase";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const url = new URL(req.url);
  const source = url.searchParams.get("source") || "tickets";
  const groupBy = url.searchParams.get("groupBy") || "status";
  const dateRange = url.searchParams.get("dateRange") || "30";

  const dateFilter = new Date();
  dateFilter.setDate(dateFilter.getDate() - parseInt(dateRange));

  let data: Record<string, number> = {};

  if (source === "tickets") {
    const tickets = await Ticket.find({ createdAt: { $gte: dateFilter } }).lean();
    data = tickets.reduce((acc: Record<string, number>, t) => {
      const row = t as unknown as Record<string, unknown>;
      const key = (row[groupBy] as string) || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  } else if (source === "assets") {
    const assets = await Asset.find().lean();
    data = assets.reduce((acc: Record<string, number>, a: Record<string, unknown>) => {
      const key = (a[groupBy] as string) || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  } else if (source === "tasks") {
    const tasks = await Task.find({ createdAt: { $gte: dateFilter } }).lean();
    data = tasks.reduce((acc: Record<string, number>, t: Record<string, unknown>) => {
      const key = (t[groupBy] as string) || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  } else if (source === "purchases") {
    const purchases = await Purchase.find({ createdAt: { $gte: dateFilter } }).lean();
    data = purchases.reduce((acc: Record<string, number>, p: Record<string, unknown>) => {
      const key = (p[groupBy] as string) || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  return NextResponse.json({ success: true, data });
}
