export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import type { Prisma, AuditAction, AuditModule } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { serialize } from "@/lib/serialize";

const MODULES = ["Ticket", "Asset", "User", "Task", "Purchase", "Settings"] as const;
const ACTIONS = ["Create", "Update", "Delete"] as const;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  if (session.role !== "SuperAdmin" && !session.userTypes.includes("Auditor")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50"));
  const moduleParam = url.searchParams.get("module") || "";
  const actionParam = url.searchParams.get("action") || "";
  const search = url.searchParams.get("search") || "";

  const where: Prisma.AuditLogWhereInput = {};
  if (moduleParam) {
    where.module = MODULES.includes(moduleParam as AuditModule)
      ? (moduleParam as AuditModule)
      : { in: [] };
  }
  if (actionParam) {
    where.action = ACTIONS.includes(actionParam as AuditAction)
      ? (actionParam as AuditAction)
      : { in: [] };
  }
  if (search) {
    const like = { contains: search, mode: "insensitive" } as const;
    where.OR = [{ actorName: like }, { targetLabel: like }];
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: serialize(logs),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
