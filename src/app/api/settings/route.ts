export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Settings } from "@/lib/models/Settings";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const url = new URL(req.url);
  const key = url.searchParams.get("key");

  if (key) {
    const setting = await Settings.findOne({ key }).lean();
    return NextResponse.json({ success: true, data: setting?.value ?? null });
  }

  const settings = await Settings.find().lean();
  const result: Record<string, unknown> = {};
  for (const s of settings) result[s.key] = s.value;

  return NextResponse.json({ success: true, data: result });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const { key, value } = await req.json();
  if (!key) return NextResponse.json({ success: false, error: "Key required" }, { status: 400 });

  const before = await Settings.findOne({ key }).lean();
  await Settings.findOneAndUpdate({ key }, { value }, { upsert: true });

  await createAuditLog({
    actorId: session._id, actorName: session.displayName,
    action: "Update", module: "Settings",
    targetId: key, targetLabel: `Setting: ${key}`,
    before: before ? { value: before.value } : undefined,
    after: { value },
  });

  return NextResponse.json({ success: true, message: "Setting updated" });
}
