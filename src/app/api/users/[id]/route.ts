export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import prisma from "@/lib/db";
import type { Prisma, UserStatus } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { serialize } from "@/lib/serialize";
import { isId } from "@/lib/utils";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isId(id)) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }
  const user = await prisma.user.findUnique({ where: { id }, omit: { password: true } });
  if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

  return NextResponse.json({ success: true, data: serialize(user) });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!isId(id)) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }
  const body = await req.json();
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

  const before = { displayName: user.displayName, email: user.email, role: user.role, userTypes: user.userTypes, status: user.status };

  const data: Prisma.UserUpdateInput = {};
  if (typeof body.displayName === "string") data.displayName = body.displayName;
  if (typeof body.username === "string") data.username = body.username.toLowerCase();
  if (typeof body.email === "string") data.email = body.email.toLowerCase();
  if (typeof body.employeeId === "string") data.employeeId = body.employeeId;
  if (body.role === "SuperAdmin" || body.role === "User") data.role = body.role;
  if (Array.isArray(body.userTypes)) data.userTypes = body.userTypes.map(String);
  if ("jobTitle" in body) data.jobTitle = body.jobTitle || null;
  if ("department" in body) data.department = body.department || null;
  if ("mobile" in body) data.mobile = body.mobile || null;
  if ("site" in body) {
    data.site = body.site ? { connect: { id: String(body.site) } } : { disconnect: true };
  }

  if (typeof body.status === "string") {
    const s = body.status.toLowerCase();
    if (s === "inactive") data.status = "Inactive" satisfies UserStatus;
    else if (s === "active") data.status = "Active" satisfies UserStatus;
  }

  if (body.password) {
    data.password = await bcryptjs.hash(String(body.password), 12);
    data.mustChangePassword = true;
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    omit: { password: true },
  });

  await createAuditLog({
    actorId: session._id,
    actorName: session.displayName,
    action: "Update",
    module: "User",
    targetId: updated.id,
    targetLabel: updated.displayName,
    before,
    after: { displayName: updated.displayName, email: updated.email, role: updated.role, userTypes: updated.userTypes, status: updated.status },
  });

  return NextResponse.json({ success: true, data: serialize(updated) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!isId(id)) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }
  if (id === session._id) {
    return NextResponse.json({ success: false, error: "Cannot delete yourself" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

  // Deactivate rather than delete — tickets, comments, and audit rows reference
  // this user and must keep resolving.
  const user = await prisma.user.update({
    where: { id },
    data: { status: "Inactive" },
    omit: { password: true },
  });

  await createAuditLog({
    actorId: session._id,
    actorName: session.displayName,
    action: "Update",
    module: "User",
    targetId: user.id,
    targetLabel: user.displayName,
    after: { status: "Inactive" },
  });

  return NextResponse.json({ success: true, data: serialize(user) });
}
