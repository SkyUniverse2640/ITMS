export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import { brandUploadFilePath } from "@/lib/brand-storage";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".avif": "image/avif",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/**
 * GET /api/brand/media/:filename
 * Streams uploaded App Logo / App Icon from disk.
 * Public (no auth) — same as static brand assets on the login page.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename: raw } = await params;
    const filename = decodeURIComponent(raw || "");
    const abs = brandUploadFilePath(filename);
    if (!abs) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const info = await stat(abs).catch(() => null);
    if (!info || !info.isFile()) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const buf = await readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    const contentType = MIME[ext] || "application/octet-stream";

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buf.length),
        // Allow browsers to cache briefly; bust via ?v= on client after re-upload
        "Cache-Control": "public, max-age=3600, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("Brand media GET failed:", err);
    return NextResponse.json({ success: false, error: "Failed to load media" }, { status: 500 });
  }
}
