import "server-only";

import path from "path";
import { existsSync } from "fs";
import { BRAND_UPLOAD_SEGMENTS, FONT_UPLOAD_SEGMENTS } from "@/lib/public-assets";

/**
 * Resolve writable public root for brand/font uploads.
 * Handles Next.js standalone (cwd = .next/standalone) vs `next dev` (project root).
 */
export function resolvePublicRoot(): string {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "public"),
    path.join(cwd, "..", "public"),
    path.join(cwd, "..", "..", "public"),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  // Default: create under cwd/public
  return path.join(cwd, "public");
}

export function brandUploadDir(): string {
  return path.join(resolvePublicRoot(), ...BRAND_UPLOAD_SEGMENTS);
}

export function fontUploadDir(): string {
  return path.join(resolvePublicRoot(), ...FONT_UPLOAD_SEGMENTS);
}

/** Safe absolute path for a brand upload filename (no path traversal) */
export function brandUploadFilePath(filename: string): string | null {
  const base = path.basename(filename || "");
  if (!base || base === "." || base === ".." || base.includes("\0")) return null;
  // only allow known image extensions
  if (!/\.(png|jpe?g|avif|webp|gif)$/i.test(base)) return null;
  const dir = brandUploadDir();
  const abs = path.resolve(dir, base);
  if (!abs.startsWith(path.resolve(dir) + path.sep) && abs !== path.resolve(dir)) {
    return null;
  }
  return abs;
}
