export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import connectDB from "@/lib/db";
import User from "@/lib/models/User";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const { id } = await params;
  const user = await User.findById(id).select("-password").lean();
  if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

  return NextResponse.json({ success: true, data: user });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const { id } = await params;
  const body = await req.json();
  const user = await User.findById(id);
  if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

  const before = { displayName: user.displayName, email: user.email, role: user.role, userTypes: user.userTypes, status: user.status };

  const ALLOWED_USER_FIELDS = new Set([
    "displayName", "username", "email", "employeeId", "role",
    "userTypes", "jobTitle", "department", "mobile", "site", "status", "password",
  ]);
  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (ALLOWED_USER_FIELDS.has(key)) sanitized[key] = body[key];
  }

  if (sanitized.password) {
    sanitized.password = await bcryptjs.hash(sanitized.password as string, 12);
    sanitized.mustChangePassword = true;
  } else {
    delete sanitized.password;
  }

  if (typeof sanitized.status === "string") {
    const s = (sanitized.status as string).toLowerCase();
    if (s === "inactive") sanitized.status = "Inactive";
    else if (s === "active") sanitized.status = "Active";
  }

  Object.assign(user, sanitized);
  await user.save();

  await createAuditLog({
    actorId: session._id,
    actorName: session.displayName,
    action: "Update",
    module: "User",
    targetId: user._id.toString(),
    targetLabel: user.displayName,
    before,
    after: { displayName: user.displayName, email: user.email, role: user.role, userTypes: user.userTypes, status: user.status },
  });

  const { password: _, ...userData } = user.toObject();
  return NextResponse.json({ success: true, data: userData });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const { id } = await params;
  if (id === session._id) {
    return NextResponse.json({ success: false, error: "Cannot delete yourself" }, { status: 400 });
  }

  const user = await User.findByIdAndUpdate(id, { status: "Inactive" }, { new: true }).select("-password");
  if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

  await createAuditLog({
    actorId: session._id,
    actorName: session.displayName,
    action: "Update",
    module: "User",
    targetId: user._id.toString(),
    targetLabel: user.displayName,
    after: { status: "Inactive" },
  });

  return NextResponse.json({ success: true, data: user });
}
