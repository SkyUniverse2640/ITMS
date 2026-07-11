export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Settings } from "@/lib/models/Settings";
import { DEFAULT_BRAND, normalizeBrandAppearance } from "@/lib/brand-shared";

/**
 * Public branding — no auth required (login page + document title).
 * Returns appearance: appName, logo, icon, font, fontUrl.
 * Logo/icon upload paths are rewritten to /api/brand/media/* for reliable serving.
 */
export async function GET() {
  try {
    await connectDB();
    const setting = await Settings.findOne({ key: "appearance" }).lean();
    const value = (setting?.value || {}) as Record<string, unknown>;
    return NextResponse.json({
      success: true,
      data: normalizeBrandAppearance(value),
    });
  } catch {
    return NextResponse.json({ success: true, data: DEFAULT_BRAND });
  }
}
