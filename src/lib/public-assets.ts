/**
 * Canonical public asset paths under /public
 *
 *  - Default icon/logo:  public/Images/default.png
 *  - Brand uploads:      public/Images/Uploads/Brand
 *  - Custom fonts:       public/Fonts/Uploads
 *  - Import templates:   public/Templates
 */

/** Default brand logo & app icon */
export const DEFAULT_LOGO = "/Images/default.png";
export const DEFAULT_ICON = "/Images/default.png";

/** Filesystem segments under process.cwd()/public for brand image uploads */
export const BRAND_UPLOAD_SEGMENTS = ["Images", "Uploads", "Brand"] as const;

/** Public URL prefix for uploaded brand images (on-disk under public/) */
export const BRAND_UPLOAD_URL_PREFIX = "/Images/Uploads/Brand";

/**
 * API URL that streams brand uploads (works in dev + standalone production
 * where static `public/Images/Uploads` may not be served reliably).
 */
export const BRAND_MEDIA_API_PREFIX = "/api/brand/media";

/** Filesystem segments for custom font uploads */
export const FONT_UPLOAD_SEGMENTS = ["Fonts", "Uploads"] as const;

/** Public URL prefix for uploaded fonts */
export const FONT_UPLOAD_URL_PREFIX = "/Fonts/Uploads";

/**
 * Static import template paths under public/Templates (backup).
 * Prefer `downloadImportTemplate()` / GET /api/templates/:kind so download
 * always works even if static files are missing.
 */
export const TEMPLATE_URLS = {
  user: "/Templates/user-import-template.csv",
  department: "/Templates/department-import-template.csv",
  asset: "/Templates/asset-import-template.csv",
} as const;

/** Notification chime */
export const NOTIFICATION_SOUND = "/Sound/Notification.mp3";

export function isBrandUploadPath(filePath: string): boolean {
  const p = (filePath || "").split("?")[0];
  return (
    p.startsWith(BRAND_UPLOAD_URL_PREFIX + "/") ||
    p.startsWith(BRAND_MEDIA_API_PREFIX + "/") ||
    p.startsWith("/uploads/brand/") ||
    p.startsWith("/Images/uploads/brand/")
  );
}

/**
 * Convert stored logo/icon path into a browser-fetchable URL.
 * Uploaded brand files are always served via /api/brand/media/* so they
 * work after `next build` / standalone (not only as static public files).
 */
export function toBrandMediaUrl(filePath: string | undefined | null): string {
  const raw = (filePath || "").trim();
  if (!raw) return DEFAULT_LOGO;
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("data:")) {
    return raw;
  }
  const pathOnly = raw.split("?")[0];
  if (pathOnly === DEFAULT_LOGO || pathOnly === DEFAULT_ICON || pathOnly === "/logo.avif") {
    return pathOnly;
  }
  if (pathOnly.startsWith(BRAND_MEDIA_API_PREFIX + "/")) {
    return pathOnly;
  }

  const prefixes = [
    BRAND_UPLOAD_URL_PREFIX + "/",
    "/uploads/brand/",
    "/Images/uploads/brand/",
  ];
  for (const prefix of prefixes) {
    if (pathOnly.startsWith(prefix)) {
      const file = pathOnly.slice(prefix.length).replace(/^\/+/, "");
      // basename only — no directory traversal
      const safe = file.split("/").pop() || file;
      if (!safe) return DEFAULT_LOGO;
      return `${BRAND_MEDIA_API_PREFIX}/${encodeURIComponent(safe)}`;
    }
  }

  // Bare filename stored by mistake
  if (!pathOnly.startsWith("/")) {
    return `${BRAND_MEDIA_API_PREFIX}/${encodeURIComponent(pathOnly)}`;
  }

  return pathOnly;
}

/** Cache-bust brand asset URLs after re-upload */
export function withBrandCacheBust(url: string, version?: string | number): string {
  if (!url) return url;
  const v = version ?? Date.now();
  return url.includes("?") ? `${url}&v=${v}` : `${url}?v=${v}`;
}

export function isFontUploadPath(filePath: string): boolean {
  return filePath.startsWith(FONT_UPLOAD_URL_PREFIX + "/");
}

export function isDefaultLogo(logoPath: string): boolean {
  return (
    !logoPath ||
    logoPath === DEFAULT_LOGO ||
    logoPath === "/logo.avif" ||
    logoPath === "/Images/default.png"
  );
}

export function isDefaultIcon(iconPath: string): boolean {
  return isDefaultLogo(iconPath);
}

/** Built-in system fonts selectable in Appearance */
export const SYSTEM_FONTS = [
  "Inter",
  "Geist",
  "system-ui",
  "Segoe UI",
  "Roboto",
  "Arial",
] as const;

export type SystemFont = (typeof SYSTEM_FONTS)[number];

/** CSS font-family stacks for built-in options */
export function systemFontStack(font: string): string {
  switch (font) {
    case "Inter":
      return '"Inter", ui-sans-serif, system-ui, sans-serif';
    case "Geist":
      return 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif';
    case "system-ui":
      return "system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    case "Segoe UI":
      return '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif';
    case "Roboto":
      return 'Roboto, "Helvetica Neue", Arial, sans-serif';
    case "Arial":
      return "Arial, Helvetica, sans-serif";
    default:
      // Custom uploaded font family name
      return `"${font.replace(/"/g, "")}", ui-sans-serif, system-ui, sans-serif`;
  }
}
