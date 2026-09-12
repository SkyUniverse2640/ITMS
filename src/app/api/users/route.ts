export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import prisma from "@/lib/db";
import type { Prisma, UserRole, UserStatus } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { serialize } from "@/lib/serialize";

/** Columns allowed for field-scoped search */
const SEARCHABLE = new Set([
  "displayName",
  "username",
  "email",
  "employeeId",
  "department",
  "jobTitle",
  "mobile",
  "role",
  "status",
  "userTypes",
]);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
  const search = url.searchParams.get("search") || "";
  const searchColumn = url.searchParams.get("searchColumn") || "";
  const role = url.searchParams.get("role") || "";
  const userType = url.searchParams.get("userType") || "";
  const status = url.searchParams.get("status") || "";

  const where: Prisma.UserWhereInput = {};
  const like = { contains: search, mode: "insensitive" } as const;

  if (search) {
    // role and status are enums, so they can't take `contains`. Resolve the
    // substring against the fixed value lists here to keep partial search
    // working ("admin" still finds SuperAdmin).
    const q = search.toLowerCase();
    const roles = (["SuperAdmin", "User"] as UserRole[]).filter((r) =>
      r.toLowerCase().includes(q)
    );
    const statuses = (["Active", "Inactive"] as UserStatus[]).filter((s) =>
      s.toLowerCase().includes(q)
    );

    if (SEARCHABLE.has(searchColumn)) {
      if (searchColumn === "role") where.role = { in: roles };
      else if (searchColumn === "status") where.status = { in: statuses };
      else if (searchColumn === "userTypes") where.userTypes = { has: search };
      else where[searchColumn as "displayName"] = like;
    } else {
      where.OR = [
        { displayName: like },
        { email: like },
        { username: like },
        { employeeId: like },
        { department: like },
        { jobTitle: like },
        { mobile: like },
        { userTypes: { has: search } },
        ...(roles.length ? [{ role: { in: roles } }] : []),
        ...(statuses.length ? [{ status: { in: statuses } }] : []),
      ];
    }
  }
  if (role) where.role = role as UserRole;
  if (userType) where.userTypes = { has: userType };
  if (status) where.status = status as UserStatus;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      omit: { password: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: serialize(users),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { username: body.username?.toLowerCase() },
        { email: body.email?.toLowerCase() },
        { employeeId: body.employeeId },
      ],
    },
  });
  if (existing) {
    return NextResponse.json({ success: false, error: "Username, email, or employee ID already exists" }, { status: 409 });
  }

  const hashedPassword = await bcryptjs.hash(body.password || "Welcome123", 12);

  // Normalize status to schema enum: Active | Inactive
  let status: UserStatus = "Active";
  if (typeof body.status === "string") {
    const s = body.status.toLowerCase();
    if (s === "inactive") status = "Inactive";
    else if (s === "active") status = "Active";
  }

  const user = await prisma.user.create({
    data: {
      displayName: body.displayName,
      username: body.username.toLowerCase(),
      email: body.email.toLowerCase(),
      employeeId: body.employeeId,
      password: hashedPassword,
      role: body.role === "SuperAdmin" ? "SuperAdmin" : "User",
      userTypes: Array.isArray(body.userTypes) ? body.userTypes.map(String) : [],
      jobTitle: body.jobTitle,
      department: body.department,
      mobile: body.mobile,
      siteId: body.site || undefined,
      status,
      mustChangePassword: true,
    },
    omit: { password: true },
  });

  await createAuditLog({
    actorId: session._id,
    actorName: session.displayName,
    action: "Create",
    module: "User",
    targetId: user.id,
    targetLabel: user.displayName,
    after: { displayName: user.displayName, email: user.email, role: user.role, userTypes: user.userTypes },
  });

  return NextResponse.json({ success: true, data: serialize(user) }, { status: 201 });
}
