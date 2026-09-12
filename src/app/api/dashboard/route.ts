export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  SYSTEM_DASHBOARDS,
  dashboardsVisibleTo,
  resolveDefaultDashboardKey,
} from "@/lib/dashboards";

/**
 * GET — list dashboards available to current user + favorite preference
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { id: session._id },
    select: { defaultDashboardKey: true, role: true },
  });
  const role = session.role;

  const system = dashboardsVisibleTo(role).map((d) => ({
    ...d,
    _id: d.key,
    isFavorite: false as boolean,
  }));

  // User-created (future) — currently empty / optional
  let custom: {
    key: string;
    name: string;
    description: string;
    audience: string;
    scope: "user";
    _id: string;
    isFavorite: boolean;
  }[] = [];
  try {
    const docs = await prisma.dashboard.findMany({
      where: { userId: session._id, scope: "user" },
      orderBy: { name: "asc" },
    });
    custom = docs.map((d) => ({
      key: d.key || d.id,
      name: d.name,
      description: "Custom dashboard",
      audience: d.audience || "all",
      scope: "user" as const,
      _id: d.id,
      isFavorite: false,
    }));
  } catch {
    custom = [];
  }

  const defaultKey = resolveDefaultDashboardKey(role, dbUser?.defaultDashboardKey);

  const list = [...system, ...custom].map((d) => ({
    ...d,
    isFavorite: d.key === defaultKey,
    isActiveDefault: d.key === defaultKey,
  }));

  return NextResponse.json({
    success: true,
    data: {
      dashboards: list,
      defaultDashboardKey: defaultKey,
      systemCatalog: SYSTEM_DASHBOARDS,
    },
  });
}

/**
 * POST — create custom dashboard (feature gated: returns 403 development message)
 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  // Feature disabled — UI also blocks
  return NextResponse.json(
    {
      success: false,
      error: "Fitur Ini Dalam Tahap Pengembangan",
      development: true,
    },
    { status: 403 }
  );
}

/**
 * PUT — set favorite / default dashboard for current user
 * body: { defaultDashboardKey: string }
 */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const key = String(body.defaultDashboardKey || body.key || "").trim();
  if (!key) {
    return NextResponse.json({ success: false, error: "defaultDashboardKey required" }, { status: 400 });
  }

  const visible = dashboardsVisibleTo(session.role).map((d) => d.key);
  if (!visible.includes(key)) {
    // Allow a custom dashboard the user owns
    const custom = await prisma.dashboard.findFirst({
      where: { key, userId: session._id },
    });
    if (!custom) {
      return NextResponse.json(
        { success: false, error: "Dashboard not available for your account" },
        { status: 403 }
      );
    }
  }

  await prisma.user.update({
    where: { id: session._id },
    data: { defaultDashboardKey: key },
  });

  return NextResponse.json({
    success: true,
    data: { defaultDashboardKey: key },
    message: "Favorite dashboard updated",
  });
}
