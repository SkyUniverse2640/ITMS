export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import prisma from "@/lib/db";
import type { Prisma, UserRole, UserStatus } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { serialize } from "@/lib/serialize";
import { isId } from "@/lib/utils";

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

function normalizeStatus(raw: unknown): UserStatus {
  if (typeof raw !== "string") return "Active";
  const s = raw.trim().toLowerCase();
  if (s === "inactive" || s === "disabled" || s === "0" || s === "false") return "Inactive";
  return "Active";
}

function normalizeRole(raw: unknown): UserRole {
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

  const body = await req.json();
  const rows = body.users ?? body.rows;
  const fileName = typeof body.fileName === "string" ? body.fileName : "import.csv";
  const updateExisting = body.updateExisting !== false;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ success: false, error: "No data provided" }, { status: 400 });
  }

  // Load managed departments + allowed user types
  const [deptSetting, utSetting] = await Promise.all([
    prisma.settings.findUnique({ where: { key: "departments" } }),
    prisma.settings.findUnique({ where: { key: "userTypes" } }),
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
    // Sanitize username: keep only letters, numbers, dot, underscore, hyphen.
    // Apostrophes/spaces (e.g. "wildan.nafi'an") are stripped so valid people
    // aren't rejected on import.
    const username = String(raw.username ?? "")
      .trim()
      .toLowerCase()
      // Apostrophe/spaces etc. (e.g. wildan.nafi'an) → strip, keep [a-z0-9._-]
      .replace(/[^a-z0-9._-]/g, "");
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
      // Skip junk / section-break / orphan-parse rows with no identity keys
      if (!displayName && !username && !email && !employeeId) {
        continue;
      }
      // Incomplete identity (e.g. broken multiline CSV leftover) → clear fail
      const missingIdentity = !username || !email || !employeeId || !displayName;
      if (missingIdentity && !username && !email && !employeeId) {
        results.push({
          row: rowNum,
          status: "failed",
          error:
            "Incomplete row (likely a line-break inside a quoted cell). Re-export CSV with quoted multi-line fields or fix the row.",
          data: snapshot,
        });
        continue;
      }

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

      // Department must exist in Manage Department (exact name, case-insensitive)
      if (department) {
        if (deptNames.size === 0) {
          errors.push(
            `Department Invalid: "${department}" (no departments configured — add them in Manage Departments first)`
          );
        } else if (!deptNames.has(department.toLowerCase())) {
          const sample = [...deptNames].slice(0, 8).join(", ");
          errors.push(
            `Department Invalid: "${department}" must match Manage Departments exactly (e.g. ${sample}${deptNames.size > 8 ? ", …" : ""})`
          );
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

      const existing = await prisma.user.findFirst({
        where: { OR: [{ username }, { email }, { employeeId }] },
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
        const conflict = await prisma.user.findFirst({
          where: {
            id: { not: existing.id },
            OR: [{ username }, { email }, { employeeId }],
          },
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

        const update: Prisma.UserUpdateInput = {
          displayName,
          username,
          email,
          employeeId,
          role,
          userTypes,
          jobTitle: jobTitle ?? null,
          department: department ?? null,
          mobile: mobile ?? null,
          status,
        };
        if (raw.password && String(raw.password).trim()) {
          update.password = await bcryptjs.hash(password, 12);
        }
        await prisma.user.update({ where: { id: existing.id }, data: update });
        results.push({ row: rowNum, status: "updated", key: username, data: snapshot });
      } else {
        await prisma.user.create({
          data: {
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
          },
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

  const history = await prisma.importHistory.create({
    data: {
      type: "users",
      fileName,
      importedById: session._id,
      importedByName: session.displayName,
      summary: { total: rows.length, created, updated, failed },
      failures: failures as unknown as Prisma.InputJsonValue,
      results: results.map((r) => ({
        row: r.row,
        status: r.status,
        error: r.error ?? null,
        key: r.key ?? null,
      })),
    },
  });

  await createAuditLog({
    actorId: session._id,
    actorName: session.displayName,
    action: "Create",
    module: "User",
    targetId: history.id,
    targetLabel: `User Import: ${created} created, ${updated} updated, ${failed} failed (${fileName})`,
  });

  return NextResponse.json({
    success: true,
    data: {
      historyId: history.id,
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

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));

  if (id) {
    const doc = isId(id)
      ? await prisma.importHistory.findUnique({ where: { id } })
      : null;
    if (!doc || doc.type !== "users") {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: serialize(doc) });
  }

  const [items, total] = await Promise.all([
    prisma.importHistory.findMany({
      where: { type: "users" },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.importHistory.count({ where: { type: "users" } }),
  ]);

  return NextResponse.json({
    success: true,
    data: serialize(items),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
