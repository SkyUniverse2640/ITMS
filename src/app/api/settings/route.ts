export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

const SENSITIVE_KEYS = new Set(["smtp"]);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const key = url.searchParams.get("key");

  const isSuperAdmin = session.role === "SuperAdmin";

  if (key) {
    if (SENSITIVE_KEYS.has(key) && !isSuperAdmin) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    const setting = await prisma.settings.findUnique({ where: { key } });
    return NextResponse.json({ success: true, data: setting?.value ?? null });
  }

  const settings = await prisma.settings.findMany();
  const result: Record<string, unknown> = {};
  for (const s of settings) {
    if (SENSITIVE_KEYS.has(s.key) && !isSuperAdmin) continue;
    result[s.key] = s.value;
  }

  return NextResponse.json({ success: true, data: result });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { key, value } = await req.json();
  if (!key) return NextResponse.json({ success: false, error: "Key required" }, { status: 400 });

  const before = await prisma.settings.findUnique({ where: { key } });
  await prisma.settings.upsert({
    where: { key },
    create: { key, value: value as Prisma.InputJsonValue },
    update: { value: value as Prisma.InputJsonValue },
  });

  await createAuditLog({
    actorId: session._id, actorName: session.displayName,
    action: "Update", module: "Settings",
    targetId: key, targetLabel: `Setting: ${key}`,
    before: before ? { value: before.value } : undefined,
    after: { value },
  });

  return NextResponse.json({ success: true, message: "Setting updated" });
}
