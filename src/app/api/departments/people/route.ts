export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  DEPT_ROLE_LABELS,
  isDeptRoleLabel,
  normalizeDepartments,
  type DeptRoleLabel,
} from "@/lib/department-roles";

/**
 * GET /api/departments/people?department=IT&label=Director
 * Returns users assigned to a department hierarchy label.
 * Without label: returns all three labels' members.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const department = (url.searchParams.get("department") || "").trim();
  const labelParam = (url.searchParams.get("label") || "").trim();

  if (!department) {
    return NextResponse.json({ success: false, error: "department required" }, { status: 400 });
  }

  const setting = await prisma.settings.findUnique({ where: { key: "departments" } });
  const depts = normalizeDepartments(setting?.value);
  const dept = depts.find((d) => d.name.toLowerCase() === department.toLowerCase());
  if (!dept) {
    return NextResponse.json({
      success: true,
      data: { department, labels: {}, people: [] },
    });
  }

  const labels: DeptRoleLabel[] = labelParam && isDeptRoleLabel(labelParam)
    ? [labelParam]
    : [...DEPT_ROLE_LABELS];

  const allIds = new Set<string>();
  const byLabel: Record<string, string[]> = {};
  for (const lab of labels) {
    const ids = dept.roles?.[lab] || [];
    byLabel[lab] = ids;
    for (const id of ids) allIds.add(id);
  }

  const users = await prisma.user.findMany({
    where: { id: { in: [...allIds] }, status: "Active" },
    select: {
      id: true,
      displayName: true,
      email: true,
      username: true,
      department: true,
      jobTitle: true,
    },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  const toPerson = (u: (typeof users)[number]) => ({
    _id: u.id,
    displayName: u.displayName,
    email: u.email,
    username: u.username,
    jobTitle: u.jobTitle ?? undefined,
  });

  const peopleByLabel: Record<string, ReturnType<typeof toPerson>[]> = {};
  for (const lab of labels) {
    peopleByLabel[lab] = (byLabel[lab] || [])
      .map((id) => userMap.get(id))
      .filter((u): u is (typeof users)[number] => Boolean(u))
      .map(toPerson);
  }

  // Flat list if single label requested
  const people =
    labelParam && isDeptRoleLabel(labelParam)
      ? peopleByLabel[labelParam] || []
      : users.map(toPerson);

  return NextResponse.json({
    success: true,
    data: {
      department: dept.name,
      roles: dept.roles,
      peopleByLabel,
      people,
      labels: DEPT_ROLE_LABELS,
    },
  });
}
