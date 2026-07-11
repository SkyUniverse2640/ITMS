export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import connectDB from "@/lib/db";
import User from "@/lib/models/User";
import ImportHistory from "@/lib/models/ImportHistory";
import { Settings } from "@/lib/models/Settings";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

const ROLES = new Set(["SuperAdmin", "User"]);
const STATUSES = new Set(["Active", "Inactive"]);
const DEFAULT_USER_TYPES = new Set(["Requester", "Technician", "Approver", "Auditor"]);

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function parseUserTypes(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(String).map((t) => t.trim()).filter(Boolean);
  }
  if (typeof raw !== "string" || !raw.trim()) return ["Requester"];
  return raw
    .split(/[|;,]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function normalizeStatus(raw: unknown): "Active" | "Inactive" {
  if (typeof raw !== "string") return "Active";
  const s = raw.trim().toLowerCase();
  if (s === "inactive" || s === "disabled" || s === "0" || s === "false") return "Inactive";
  return "Active";
}

function normalizeRole(raw: unknown): "SuperAdmin" | "User" {
  if (typeof raw !== "string") return "User";
  const s = raw.trim().toLowerCase();
  if (s === "superadmin" || s === "super_admin" || s === "admin") return "SuperAdmin";
  return "User";
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const body = await req.json();
  const rows = body.users ?? body.rows;
  const fileName = typeof body.fileName === "string" ? body.fileName : "import.csv";
  const updateExisting = body.updateExisting !== false;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ success: false, error: "No data provided" }, { status: 400 });
  }

  // Load managed departments + allowed user types
  const [deptSetting, utSetting] = await Promise.all([
    Settings.findOne({ key: "departments" }).lean(),
    Settings.findOne({ key: "userTypes" }).lean(),
  ]);

  const deptNames = new Set<string>();
  if (Array.isArray(deptSetting?.value)) {
    for (const d of deptSetting.value as unknown[]) {
      if (typeof d === "string") deptNames.add(d.trim().toLowerCase());
      else if (d && typeof d === "object" && "name" in d) {
        deptNames.add(String((d as { name: string }).name).trim().toLowerCase());
      }
    }
  }

  const allowedTypes = new Set<string>(DEFAULT_USER_TYPES);
  if (Array.isArray(utSetting?.value)) {
    for (const t of utSetting.value as unknown[]) {
      if (typeof t === "string") allowedTypes.add(t);
      else if (t && typeof t === "object" && "name" in t) {
        allowedTypes.add(String((t as { name: string }).name));
      }
    }
  }

  // Within-file uniqueness
  const seenUsername = new Set<string>();
  const seenEmail = new Set<string>();
  const seenEmp = new Set<string>();

  type RowResult = {
    row: number;
    status: "created" | "updated" | "failed";
    error?: string;
    key?: string;
    data?: Record<string, unknown>;
  };

  const results: RowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // 1-based data row (row 1 = header)
    const raw = rows[i] as Record<string, unknown>;
    const displayName = String(raw.displayName ?? raw.displayname ?? "").trim();
    const username = String(raw.username ?? "").trim().toLowerCase();
    const email = String(raw.email ?? "").trim().toLowerCase();
    const employeeId = String(raw.employeeId ?? raw.employee_id ?? "").trim();
    const jobTitle = String(raw.jobTitle ?? raw.job_title ?? "").trim() || undefined;
    const department = String(raw.department ?? "").trim() || undefined;
    const mobile = String(raw.mobile ?? "").trim() || undefined;
    const password = String(raw.password ?? "").trim() || "Welcome123";
    const role = normalizeRole(raw.role);
    const status = normalizeStatus(raw.status);
    const userTypes = parseUserTypes(raw.userTypes ?? raw.user_types);

    const snapshot = {
      displayName,
      username,
      email,
      employeeId,
      role,
      userTypes,
      jobTitle,
      department,
      mobile,
      status,
    };

    try {
      const errors: string[] = [];
      if (!displayName) errors.push("displayName is required");
      if (!username) errors.push("username is required");
      if (!email) errors.push("email is required");
      if (!employeeId) errors.push("employeeId is required");
      if (email && !isEmail(email)) errors.push("email format is invalid");
      if (role && !ROLES.has(role)) errors.push(`role must be SuperAdmin or User (got "${raw.role}")`);
      if (status && !STATUSES.has(status)) errors.push(`status must be Active or Inactive`);
      if (username && !/^[a-z0-9._-]+$/i.test(username)) {
        errors.push("username may only contain letters, numbers, . _ -");
      }
      if (password.length < 6) errors.push("password must be at least 6 characters");

      for (const t of userTypes) {
        if (!allowedTypes.has(t)) {
          errors.push(`userType "${t}" is not allowed (allowed: ${[...allowedTypes].join(", ")})`);
        }
      }
      if (userTypes.length === 0) errors.push("at least one userType is required");

      // Department must exist in Manage Department (or fail the row)
      if (department) {
        if (deptNames.size === 0 || !deptNames.has(department.toLowerCase())) {
          errors.push("Department Invalid");
        }
      }

      if (username && seenUsername.has(username)) errors.push(`duplicate username in file: ${username}`);
      if (email && seenEmail.has(email)) errors.push(`duplicate email in file: ${email}`);
      if (employeeId && seenEmp.has(employeeId)) errors.push(`duplicate employeeId in file: ${employeeId}`);

      if (errors.length) {
        results.push({ row: rowNum, status: "failed", error: errors.join("; "), data: snapshot });
        continue;
      }

      seenUsername.add(username);
      seenEmail.add(email);
      seenEmp.add(employeeId);

      const existing = await User.findOne({
        $or: [{ username }, { email }, { employeeId }],
      });

      if (existing) {
        // Match on same identity keys only if consistent
        const sameUser =
          existing.username === username ||
          existing.email === email ||
          existing.employeeId === employeeId;

        if (!sameUser || !updateExisting) {
          results.push({
            row: rowNum,
            status: "failed",
            error: "username, email, or employeeId already exists",
            data: snapshot,
            key: username,
          });
          continue;
        }

        // Conflict if another field collides with a different user
        const conflict = await User.findOne({
          _id: { $ne: existing._id },
          $or: [{ username }, { email }, { employeeId }],
        });
        if (conflict) {
          results.push({
            row: rowNum,
            status: "failed",
            error: "username/email/employeeId conflict with another user",
            data: snapshot,
            key: username,
          });
          continue;
        }

        existing.displayName = displayName;
        existing.username = username;
        existing.email = email;
        existing.employeeId = employeeId;
        existing.role = role;
        existing.userTypes = userTypes;
        existing.jobTitle = jobTitle;
        existing.department = department;
        existing.mobile = mobile;
        existing.status = status;
        if (raw.password && String(raw.password).trim()) {
          existing.password = await bcryptjs.hash(password, 12);
        }
        await existing.save();
        results.push({ row: rowNum, status: "updated", key: username, data: snapshot });
      } else {
        await User.create({
          displayName,
          username,
          email,
          employeeId,
          password: await bcryptjs.hash(password, 12),
          role,
          userTypes,
          jobTitle,
          department,
          mobile,
          status,
          mustChangePassword: true,
        });
        results.push({ row: rowNum, status: "created", key: username, data: snapshot });
      }
    } catch (err) {
      results.push({
        row: rowNum,
        status: "failed",
        error: (err as Error).message || "Unknown error",
        data: snapshot,
      });
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  const updated = results.filter((r) => r.status === "updated").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const failures = results
    .filter((r) => r.status === "failed")
    .map((r) => ({ row: r.row, data: r.data, error: r.error || "failed" }));

  const history = await ImportHistory.create({
    type: "users",
    fileName,
    importedBy: session._id,
    importedByName: session.displayName,
    summary: { total: rows.length, created, updated, failed },
    failures,
    results: results.map((r) => ({
      row: r.row,
      status: r.status,
      error: r.error,
      key: r.key,
    })),
  });

  await createAuditLog({
    actorId: session._id,
    actorName: session.displayName,
    action: "Create",
    module: "User",
    targetId: history._id.toString(),
    targetLabel: `User Import: ${created} created, ${updated} updated, ${failed} failed (${fileName})`,
  });

  return NextResponse.json({
    success: true,
    data: {
      historyId: history._id,
      results,
      failures,
      summary: { total: rows.length, created, updated, failed },
    },
  });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));

  if (id) {
    const doc = await ImportHistory.findById(id).lean();
    if (!doc || doc.type !== "users") {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: doc });
  }

  const [items, total] = await Promise.all([
    ImportHistory.find({ type: "users" })
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ImportHistory.countDocuments({ type: "users" }),
  ]);

  return NextResponse.json({
    success: true,
    data: items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
