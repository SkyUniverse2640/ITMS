export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/lib/models/User";
import { Settings } from "@/lib/models/Settings";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { DEFAULT_ONBOARDING, type OnboardingState } from "@/lib/onboarding";
import { DEFAULT_BRAND } from "@/lib/brand-shared";
import { isDefaultIcon, isDefaultLogo } from "@/lib/public-assets";

async function computeReadiness() {
  await connectDB();
  const deptSetting = await Settings.findOne({ key: "departments" }).lean();
  const depts = Array.isArray(deptSetting?.value) ? (deptSetting!.value as unknown[]) : [];
  const userCount = await User.countDocuments({ status: "Active" });
  const nonAdminCount = await User.countDocuments({
    status: "Active",
    role: { $ne: "SuperAdmin" },
  });

  const appSetting = await Settings.findOne({ key: "appearance" }).lean();
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

  await connectDB();
  const setting = await Settings.findOne({ key: "onboarding" }).lean();
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

  await connectDB();
  const body = await req.json().catch(() => ({}));
  const action = body?.action as string;

  const readiness = await computeReadiness();

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
    await Settings.findOneAndUpdate({ key: "onboarding" }, { value }, { upsert: true });

    await createAuditLog({
      actorId: session._id,
      actorName: session.displayName,
      action: "Update",
      module: "Settings",
      targetId: "onboarding",
      targetLabel: "Onboarding completed",
      after: value as unknown as Record<string, unknown>,
    });

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
    await Settings.findOneAndUpdate({ key: "onboarding" }, { value }, { upsert: true });
    await createAuditLog({
      actorId: session._id,
      actorName: session.displayName,
      action: "Update",
      module: "Settings",
      targetId: "onboarding",
      targetLabel: "Onboarding skipped (users partial)",
      after: value as unknown as Record<string, unknown>,
    });
    return NextResponse.json({ success: true, data: { ...value, needsOnboarding: false } });
  }

  return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
}
