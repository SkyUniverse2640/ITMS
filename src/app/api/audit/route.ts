export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import AuditLog from "@/lib/models/AuditLog";
import { getSession } from "@/lib/auth";
import { escapeRegex } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  if (session.role !== "SuperAdmin" && !session.userTypes.includes("Auditor")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50"));
  const module = url.searchParams.get("module") || "";
  const action = url.searchParams.get("action") || "";
  const search = url.searchParams.get("search") || "";

  const filter: Record<string, unknown> = {};
  if (module) filter.module = module;
  if (action) filter.action = action;
  if (search) {
    const escaped = escapeRegex(search);
    filter.$or = [
      { actorName: { $regex: escaped, $options: "i" } },
      { targetLabel: { $regex: escaped, $options: "i" } },
    ];
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort("-createdAt").skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);

  return NextResponse.json({
    success: true,
    data: logs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
