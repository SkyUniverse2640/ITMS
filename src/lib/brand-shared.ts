/** Client-safe brand types & defaults (no database or Node APIs). */

import {
  DEFAULT_ICON,
  DEFAULT_LOGO,
  toBrandMediaUrl,
} from "@/lib/public-assets";

export type BrandAppearance = {
  appName: string;
  /** App Logo — login, sidebar, topbar */
  logo: string;
  /** App Icon — browser title / favicon */
  icon: string;
  /** Font family name (built-in or custom upload name) */
  font: string;
  /** Optional custom font file URL under /Fonts/Uploads */
  fontUrl?: string;
};

export const DEFAULT_BRAND: BrandAppearance = {
  appName: "NexusDesk",
  logo: DEFAULT_LOGO,
  icon: DEFAULT_ICON,
  font: "Inter",
  fontUrl: "",
};

/** Normalize raw appearance settings → browser-safe URLs */
export function normalizeBrandAppearance(
  value: Partial<BrandAppearance> | Record<string, unknown> | null | undefined
): BrandAppearance {
  const v = (value || {}) as Record<string, unknown>;
  const logoRaw = String(v.logo || DEFAULT_BRAND.logo);
  const iconRaw = String(v.icon || v.logo || DEFAULT_BRAND.icon);
  return {
    appName: String(v.appName || DEFAULT_BRAND.appName),
    logo: toBrandMediaUrl(logoRaw),
    icon: toBrandMediaUrl(iconRaw),
    font: String(v.font || DEFAULT_BRAND.font),
    fontUrl: v.fontUrl ? String(v.fontUrl) : "",
  };
}
