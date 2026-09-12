export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { DEFAULT_BRAND, normalizeBrandAppearance } from "@/lib/brand-shared";

/**
 * Public branding — no auth required (login page + document title).
 * Returns appearance: appName, logo, icon, font, fontUrl.
 * Logo/icon upload paths are rewritten to /api/brand/media/* for reliable serving.
 */
export async function GET() {
  try {
    const setting = await prisma.settings.findUnique({ where: { key: "appearance" } });
    const value = (setting?.value || {}) as Record<string, unknown>;
    return NextResponse.json({
      success: true,
      data: normalizeBrandAppearance(value),
    });
  } catch {
    return NextResponse.json({ success: true, data: DEFAULT_BRAND });
  }
}
