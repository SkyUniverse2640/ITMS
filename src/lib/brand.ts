import "server-only";

import connectDB from "@/lib/db";
import { Settings } from "@/lib/models/Settings";
import {
  DEFAULT_BRAND,
  normalizeBrandAppearance,
  type BrandAppearance,
} from "@/lib/brand-shared";

export type { BrandAppearance } from "@/lib/brand-shared";
export { DEFAULT_BRAND, normalizeBrandAppearance } from "@/lib/brand-shared";

/** Server-side brand load for metadata / SSR — never import from client components */
export async function getBrandAppearance(): Promise<BrandAppearance> {
  try {
    await connectDB();
    const setting = await Settings.findOne({ key: "appearance" }).lean();
    const value = (setting?.value || {}) as Record<string, unknown>;
    return normalizeBrandAppearance(value);
  } catch {
    return DEFAULT_BRAND;
  }
}
