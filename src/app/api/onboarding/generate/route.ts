export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import prisma from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { RECOMMENDED_DEPARTMENTS, RECOMMENDED_USERS } from "@/lib/onboarding";

function genId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const type = body?.type as string;

  if (type === "departments") {
    const setting = await prisma.settings.findUnique({ where: { key: "departments" } });
    const existing = Array.isArray(setting?.value)
      ? (setting.value as unknown as { id?: string; name: string; description?: string }[])
      : [];
    const existingNames = new Set(existing.map((d) => d.name.toLowerCase()));

    const added: { id: string; name: string; description: string }[] = [];
    for (const rec of RECOMMENDED_DEPARTMENTS) {
      if (existingNames.has(rec.name.toLowerCase())) continue;
      added.push({ id: genId("dept"), name: rec.name, description: rec.description });
      existingNames.add(rec.name.toLowerCase());
    }

    const next = [...existing, ...added];
    await prisma.settings.upsert({
      where: { key: "departments" },
      create: { key: "departments", value: next as unknown as Prisma.InputJsonValue },
      update: { value: next as unknown as Prisma.InputJsonValue },
    });

    await createAuditLog({
      actorId: session._id,
      actorName: session.displayName,
      action: "Update",
      module: "Settings",
      targetId: "departments",
      targetLabel: "Generate recommended departments",
      after: { added: added.length, total: next.length },
    });

    return NextResponse.json({
      success: true,
      data: {
        departments: next,
        added: added.length,
        skipped: RECOMMENDED_DEPARTMENTS.length - added.length,
      },
      message:
        added.length > 0
          ? `Added ${added.length} recommended department(s)`
          : "All recommended departments already exist",
    });
  }

  if (type === "users") {
    const deptSetting = await prisma.settings.findUnique({ where: { key: "departments" } });
    const depts = Array.isArray(deptSetting?.value)
      ? (deptSetting.value as unknown as { name: string }[])
      : [];
    const deptNames = new Set(depts.map((d) => d.name));

    if (deptNames.size === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Create departments first (import, manual, or generate recommendations)",
        },
        { status: 400 }
      );
    }

    let created = 0;
    let skipped = 0;
    const createdUsers: string[] = [];

    for (const rec of RECOMMENDED_USERS) {
      // Only create if recommended department exists (or fall back to first dept)
      let department = rec.department;
      if (!deptNames.has(department)) {
        department = depts[0].name;
      }

      const exists = await prisma.user.findFirst({
        where: {
          OR: [
            { username: rec.username.toLowerCase() },
            { email: rec.email.toLowerCase() },
            { employeeId: rec.employeeId },
          ],
        },
      });
      if (exists) {
        skipped++;
        continue;
      }

      const hashed = await bcryptjs.hash(rec.password, 12);
      await prisma.user.create({
        data: {
          displayName: rec.displayName,
          username: rec.username.toLowerCase(),
          email: rec.email.toLowerCase(),
          employeeId: rec.employeeId,
          password: hashed,
          role: rec.role,
          userTypes: rec.userTypes,
          jobTitle: rec.jobTitle,
          department,
          status: "Active",
          mustChangePassword: true,
        },
      });
      created++;
      createdUsers.push(rec.username);
    }

    await createAuditLog({
      actorId: session._id,
      actorName: session.displayName,
      action: "Create",
      module: "User",
      targetId: "recommended-users",
      targetLabel: "Generate recommended users",
      after: { created, skipped, usernames: createdUsers },
    });

    return NextResponse.json({
      success: true,
      data: { created, skipped, usernames: createdUsers },
      message:
        created > 0
          ? `Created ${created} sample user(s) (temp password Welcome123 — they must change it)`
          : "Recommended users already exist",
    });
  }

  return NextResponse.json(
    { success: false, error: "type must be 'departments' or 'users'" },
    { status: 400 }
  );
}
