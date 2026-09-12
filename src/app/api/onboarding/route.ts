export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { DEFAULT_ONBOARDING, type OnboardingState } from "@/lib/onboarding";
import { DEFAULT_BRAND } from "@/lib/brand-shared";
import { isDefaultIcon, isDefaultLogo } from "@/lib/public-assets";

async function computeReadiness() {
  const deptSetting = await prisma.settings.findUnique({ where: { key: "departments" } });
  const depts = Array.isArray(deptSetting?.value) ? (deptSetting.value as unknown[]) : [];
  const userCount = await prisma.user.count({ where: { status: "Active" } });
  const nonAdminCount = await prisma.user.count({
    where: { status: "Active", role: { not: "SuperAdmin" } },
  });

  const appSetting = await prisma.settings.findUnique({ where: { key: "appearance" } });
  const app = (appSetting?.value || {}) as Record<string, unknown>;
  const appName = String(app.appName || "").trim();
  const logo = String(app.logo || "");
  const icon = String(app.icon || app.logo || "");

  // Systems Appearance is mandatory: customize name, logo, and icon (not factory defaults)
  const nameReady =
    appName.length > 0 && appName.toLowerCase() !== DEFAULT_BRAND.appName.toLowerCase();
  const logoReady = Boolean(logo) && !isDefaultLogo(logo);
  const iconReady = Boolean(icon) && !isDefaultIcon(icon);
  const appearanceReady = nameReady && logoReady && iconReady;

  return {
    departmentCount: depts.length,
    userCount,
    nonAdminCount,
    appName: appName || DEFAULT_BRAND.appName,
    logo: logo || DEFAULT_BRAND.logo,
    icon: icon || DEFAULT_BRAND.icon,
    nameReady,
    logoReady,
    iconReady,
    appearanceReady,
    departmentsReady: depts.length > 0,
    usersReady: nonAdminCount > 0,
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const setting = await prisma.settings.findUnique({ where: { key: "onboarding" } });
  const stored = (setting?.value || DEFAULT_ONBOARDING) as Partial<OnboardingState>;
  const readiness = await computeReadiness();

  const data = {
    completed: Boolean(stored.completed),
    completedAt: stored.completedAt ?? null,
    appearanceReady: readiness.appearanceReady,
    departmentsReady: readiness.departmentsReady,
    usersReady: readiness.usersReady,
    departmentCount: readiness.departmentCount,
    userCount: readiness.userCount,
    nonAdminCount: readiness.nonAdminCount,
    appName: readiness.appName,
    logo: readiness.logo,
    icon: readiness.icon,
    nameReady: readiness.nameReady,
    logoReady: readiness.logoReady,
    iconReady: readiness.iconReady,
    needsOnboarding: false as boolean,
  };

  if (stored.completed) {
    data.needsOnboarding = false;
  } else if (session.role === "SuperAdmin") {
    data.needsOnboarding = true;
  }

  return NextResponse.json({ success: true, data });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body?.action as string;

  const readiness = await computeReadiness();

  const save = async (value: OnboardingState, label: string) => {
    await prisma.settings.upsert({
      where: { key: "onboarding" },
      create: { key: "onboarding", value: value as unknown as Prisma.InputJsonValue },
      update: { value: value as unknown as Prisma.InputJsonValue },
    });
    await createAuditLog({
      actorId: session._id,
      actorName: session.displayName,
      action: "Update",
      module: "Settings",
      targetId: "onboarding",
      targetLabel: label,
      after: value as unknown as Record<string, unknown>,
    });
  };

  if (action === "complete") {
    if (!readiness.appearanceReady) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Complete Systems Appearance first: set a custom App Name, App Logo, and App Icon (not defaults)",
        },
        { status: 400 }
      );
    }
    if (!readiness.departmentsReady) {
      return NextResponse.json(
        { success: false, error: "Add at least one department before finishing onboarding" },
        { status: 400 }
      );
    }
    if (!readiness.usersReady) {
      return NextResponse.json(
        {
          success: false,
          error: "Add at least one non-admin user (import or generate) before finishing onboarding",
        },
        { status: 400 }
      );
    }

    const value: OnboardingState = {
      completed: true,
      completedAt: new Date().toISOString(),
      appearanceReady: true,
      departmentsReady: true,
      usersReady: true,
    };
    await save(value, "Onboarding completed");

    return NextResponse.json({ success: true, data: { ...value, needsOnboarding: false } });
  }

  if (action === "skip") {
    // Skip users only — appearance + departments still required
    if (!readiness.appearanceReady) {
      return NextResponse.json(
        {
          success: false,
          error: "Complete Systems Appearance (App Name, Logo, Icon) before finishing",
        },
        { status: 400 }
      );
    }
    if (!readiness.departmentsReady) {
      return NextResponse.json(
        { success: false, error: "Create at least one department before skipping user setup" },
        { status: 400 }
      );
    }
    const value: OnboardingState = {
      completed: true,
      completedAt: new Date().toISOString(),
      appearanceReady: readiness.appearanceReady,
      departmentsReady: readiness.departmentsReady,
      usersReady: readiness.usersReady,
    };
    await save(value, "Onboarding skipped (users partial)");
    return NextResponse.json({ success: true, data: { ...value, needsOnboarding: false } });
  }

  return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
}
