export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { createAuditLog } from "@/lib/audit";
import {
  BRAND_MEDIA_API_PREFIX,
  BRAND_UPLOAD_URL_PREFIX,
  FONT_UPLOAD_URL_PREFIX,
  isBrandUploadPath,
  isFontUploadPath,
  toBrandMediaUrl,
} from "@/lib/public-assets";
import { brandUploadDir, fontUploadDir, resolvePublicRoot } from "@/lib/brand-storage";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_FONT_BYTES = 2 * 1024 * 1024; // 2MB

type UploadKind = "logo" | "icon" | "font";

const IMAGE_ALLOWED: Record<string, { ext: string; mimes: string[] }> = {
  png: { ext: ".png", mimes: ["image/png"] },
  jpg: { ext: ".jpg", mimes: ["image/jpeg", "image/jpg"] },
  jpeg: { ext: ".jpeg", mimes: ["image/jpeg", "image/jpg"] },
  avif: { ext: ".avif", mimes: ["image/avif"] },
};

const FONT_ALLOWED: Record<string, { ext: string; mimes: string[]; format: string }> = {
  ttf: { ext: ".ttf", mimes: ["font/ttf", "application/x-font-ttf", "application/octet-stream"], format: "truetype" },
  otf: { ext: ".otf", mimes: ["font/otf", "application/x-font-otf", "application/octet-stream"], format: "opentype" },
  woff: { ext: ".woff", mimes: ["font/woff", "application/font-woff", "application/octet-stream"], format: "woff" },
  woff2: {
    ext: ".woff2",
    mimes: ["font/woff2", "application/font-woff2", "application/octet-stream"],
    format: "woff2",
  },
};

function getExt(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : "";
}

function isAllowedImageMagic(buf: Buffer, ext: string): boolean {
  if (buf.length < 12) return false;
  if (ext === "png") {
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  }
  if (ext === "jpg" || ext === "jpeg") {
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (ext === "avif") {
    const ftyp = buf.toString("ascii", 4, 8);
    if (ftyp !== "ftyp") return false;
    const rest = buf.toString("ascii", 8, Math.min(buf.length, 32));
    return rest.includes("avif") || rest.includes("avis") || rest.includes("mif1");
  }
  return false;
}

function isAllowedFontMagic(buf: Buffer, ext: string): boolean {
  if (buf.length < 4) return false;
  if (ext === "woff2") {
    return buf.toString("ascii", 0, 4) === "wOF2";
  }
  if (ext === "woff") {
    return buf.toString("ascii", 0, 4) === "wOFF";
  }
  if (ext === "otf") {
    return buf.toString("ascii", 0, 4) === "OTTO";
  }
  if (ext === "ttf") {
    // TrueType: 0x00010000 or 'true' / 'typ1'
    const sig = buf.readUInt32BE(0);
    if (sig === 0x00010000) return true;
    const tag = buf.toString("ascii", 0, 4);
    return tag === "true" || tag === "typ1";
  }
  return false;
}

/** Sanitize font family name from filename */
function fontFamilyFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  const cleaned = base
    .replace(/[_-]+/g, " ")
    .replace(/[^a-zA-Z0-9 ]+/g, "")
    .trim()
    .replace(/\s+/g, " ");
  return cleaned || "Custom Font";
}

async function safeUnlinkBrand(publicUrl: string) {
  try {
    // Accept both /Images/Uploads/Brand/x and /api/brand/media/x
    let name = publicUrl.split("?")[0];
    if (name.startsWith(BRAND_MEDIA_API_PREFIX + "/")) {
      name = decodeURIComponent(name.slice(BRAND_MEDIA_API_PREFIX.length + 1));
    } else if (name.startsWith(BRAND_UPLOAD_URL_PREFIX + "/")) {
      name = name.slice(BRAND_UPLOAD_URL_PREFIX.length + 1);
    } else {
      return;
    }
    const base = path.basename(name);
    const abs = path.join(brandUploadDir(), base);
    await unlink(abs);
  } catch {
    /* ignore */
  }
}

async function safeUnlinkFont(publicUrl: string) {
  try {
    if (!isFontUploadPath(publicUrl)) return;
    const name = path.basename(publicUrl.split("?")[0]);
    const abs = path.join(fontUploadDir(), name);
    await unlink(abs);
  } catch {
    /* ignore */
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const kindRaw = String(formData.get("kind") || "logo").toLowerCase();
    const kind: UploadKind =
      kindRaw === "icon" || kindRaw === "font" || kindRaw === "logo" ? kindRaw : "logo";

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ success: false, error: "Empty file" }, { status: 400 });
    }

    const ext = getExt(file.name);
    const bytes = Buffer.from(await file.arrayBuffer());

    const before = await prisma.settings.findUnique({ where: { key: "appearance" } });
    const prevValue = (before?.value || {}) as Record<string, unknown>;

    /** Persist the updated appearance blob. */
    const saveAppearance = (value: Record<string, unknown>) =>
      prisma.settings.upsert({
        where: { key: "appearance" },
        create: { key: "appearance", value: value as Prisma.InputJsonValue },
        update: { value: value as Prisma.InputJsonValue },
      });

    if (kind === "font") {
      if (file.size > MAX_FONT_BYTES) {
        return NextResponse.json(
          { success: false, error: "Font file too large. Maximum size is 2MB." },
          { status: 400 }
        );
      }
      const allowed = FONT_ALLOWED[ext];
      if (!allowed) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid font type. Only TTF, OTF, WOFF, and WOFF2 are allowed.",
          },
          { status: 400 }
        );
      }
      const mime = (file.type || "").toLowerCase();
      if (mime && !allowed.mimes.includes(mime) && mime !== "application/octet-stream") {
        // Some browsers send empty/wrong mime — magic check is authoritative
      }
      if (!isAllowedFontMagic(bytes, ext)) {
        return NextResponse.json(
          { success: false, error: "File content does not match a valid font format." },
          { status: 400 }
        );
      }

      const dir = fontUploadDir();
      await mkdir(dir, { recursive: true });
      const family = fontFamilyFromFilename(file.name);
      const safeFamily = family.replace(/\s+/g, "-").toLowerCase().slice(0, 40);
      const filename = `font-${safeFamily}-${Date.now()}${allowed.ext}`;
      await writeFile(path.join(dir, filename), bytes);
      const publicPath = `${FONT_UPLOAD_URL_PREFIX}/${filename}`;

      const nextValue = {
        ...prevValue,
        font: family,
        fontUrl: publicPath,
      };
      await saveAppearance(nextValue);

      const prevFont = String(prevValue.fontUrl || "");
      if (isFontUploadPath(prevFont) && prevFont !== publicPath) {
        await safeUnlinkFont(prevFont);
      }

      await createAuditLog({
        actorId: session._id,
        actorName: session.displayName,
        action: "Update",
        module: "Settings",
        targetId: "appearance",
        targetLabel: "Setting: appearance (font upload)",
        before: before ? { value: before.value } : undefined,
        after: { value: nextValue },
      });

      return NextResponse.json({
        success: true,
        data: { font: family, fontUrl: publicPath },
        message: "Font uploaded",
      });
    }

    // logo | icon image
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { success: false, error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }
    const allowed = IMAGE_ALLOWED[ext];
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "Invalid file type. Only PNG, JPG, JPEG, and AVIF are allowed." },
        { status: 400 }
      );
    }
    const mime = (file.type || "").toLowerCase();
    if (mime && !allowed.mimes.includes(mime)) {
      return NextResponse.json(
        { success: false, error: "Invalid file type. Only PNG, JPG, JPEG, and AVIF are allowed." },
        { status: 400 }
      );
    }
    if (!isAllowedImageMagic(bytes, ext)) {
      return NextResponse.json(
        { success: false, error: "File content does not match PNG, JPG, JPEG, or AVIF format." },
        { status: 400 }
      );
    }

    const dir = brandUploadDir();
    await mkdir(dir, { recursive: true });
    const filename = `${kind}-${Date.now()}${allowed.ext}`;
    await writeFile(path.join(dir, filename), bytes);

    // Store API media URL so logo/icon always load in dev + production/standalone
    const publicPath = `${BRAND_MEDIA_API_PREFIX}/${filename}`;
    // Also keep a static-public twin path for reference / migration
    const diskPublicPath = `${BRAND_UPLOAD_URL_PREFIX}/${filename}`;

    const field = kind === "icon" ? "icon" : "logo";
    const nextValue = {
      ...prevValue,
      [field]: publicPath,
      // mirror for tools that expect static path (optional)
      [`${field}File`]: diskPublicPath,
    };
    await saveAppearance(nextValue);

    const prevPath = String(prevValue[field] || "");
    if (isBrandUploadPath(prevPath) && prevPath !== publicPath && prevPath !== diskPublicPath) {
      await safeUnlinkBrand(prevPath);
    }

    await createAuditLog({
      actorId: session._id,
      actorName: session.displayName,
      action: "Update",
      module: "Settings",
      targetId: "appearance",
      targetLabel: `Setting: appearance (${kind} upload)`,
      before: before ? { value: before.value } : undefined,
      after: { value: nextValue },
    });

    return NextResponse.json({
      success: true,
      data: {
        [field]: publicPath,
        url: toBrandMediaUrl(publicPath),
        publicRoot: resolvePublicRoot(),
      },
      message: kind === "icon" ? "App icon uploaded" : "App logo uploaded",
    });
  } catch (err) {
    console.error("Brand upload error:", err);
    return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 });
  }
}
