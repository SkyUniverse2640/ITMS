export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import connectDB from "@/lib/db";
import User from "@/lib/models/User";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { escapeRegex } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
  const search = url.searchParams.get("search") || "";
  const searchColumn = url.searchParams.get("searchColumn") || "";
  const role = url.searchParams.get("role") || "";
  const userType = url.searchParams.get("userType") || "";
  const status = url.searchParams.get("status") || "";

  const filter: Record<string, unknown> = {};
  const rx = (q: string) => ({ $regex: escapeRegex(q), $options: "i" });

  /** Columns allowed for field-scoped search */
  const SEARCHABLE: Record<string, string> = {
    displayName: "displayName",
    username: "username",
    email: "email",
    employeeId: "employeeId",
    department: "department",
    jobTitle: "jobTitle",
    mobile: "mobile",
    role: "role",
    status: "status",
    userTypes: "userTypes",
  };

  if (search) {
    const col = SEARCHABLE[searchColumn];
    if (col) {
      filter[col] = rx(search);
    } else {
      filter.$or = [
        { displayName: rx(search) },
        { email: rx(search) },
        { username: rx(search) },
        { employeeId: rx(search) },
        { department: rx(search) },
        { jobTitle: rx(search) },
        { mobile: rx(search) },
        { role: rx(search) },
        { status: rx(search) },
        { userTypes: rx(search) },
      ];
    }
  }
  if (role) filter.role = role;
  if (userType) filter.userTypes = userType;
  if (status) filter.status = status;

  const [users, total] = await Promise.all([
    User.find(filter).select("-password").sort("-createdAt").skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  return NextResponse.json({
    success: true,
    data: users,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const body = await req.json();

  const existing = await User.findOne({
    $or: [{ username: body.username?.toLowerCase() }, { email: body.email?.toLowerCase() }, { employeeId: body.employeeId }],
  });
  if (existing) {
    return NextResponse.json({ success: false, error: "Username, email, or employee ID already exists" }, { status: 409 });
  }

  const hashedPassword = await bcryptjs.hash(body.password || "Welcome123", 12);

  // Normalize status to schema enum: Active | Inactive
  let status: "Active" | "Inactive" = "Active";
  if (typeof body.status === "string") {
    const s = body.status.toLowerCase();
    if (s === "inactive") status = "Inactive";
    else if (s === "active") status = "Active";
  }

  const user = await User.create({
    displayName: body.displayName,
    username: body.username.toLowerCase(),
    email: body.email.toLowerCase(),
    employeeId: body.employeeId,
    password: hashedPassword,
    role: body.role,
    userTypes: body.userTypes,
    jobTitle: body.jobTitle,
    department: body.department,
    mobile: body.mobile,
    site: body.site,
    status,
    mustChangePassword: true,
  });

  await createAuditLog({
    actorId: session._id,
    actorName: session.displayName,
    action: "Create",
    module: "User",
    targetId: user._id.toString(),
    targetLabel: user.displayName,
    after: { displayName: user.displayName, email: user.email, role: user.role, userTypes: user.userTypes },
  });

  const { password: _, ...userData } = user.toObject();
  return NextResponse.json({ success: true, data: userData }, { status: 201 });
}
