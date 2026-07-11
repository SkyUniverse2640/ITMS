export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Notification from "@/lib/models/Notification";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const unreadOnly = url.searchParams.get("unread") === "true";

  const filter: Record<string, unknown> = { recipient: session._id };
  if (unreadOnly) filter.read = false;

  const [notifications, unreadCount] = await Promise.all([
    Notification.find(filter).sort("-createdAt").limit(limit).lean(),
    Notification.countDocuments({ recipient: session._id, read: false }),
  ]);

  return NextResponse.json({ success: true, data: notifications, unreadCount });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const { ids, markAll } = await req.json();

  if (markAll) {
    await Notification.updateMany({ recipient: session._id, read: false }, { read: true });
  } else if (ids?.length) {
    await Notification.updateMany({ _id: { $in: ids }, recipient: session._id }, { read: true });
  }

  return NextResponse.json({ success: true, message: "Notifications updated" });
}

/**
 * DELETE — remove notifications for current user
 * body: { deleteAll: true } | { ids: string[] }
 */
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  await connectDB();
  let body: { deleteAll?: boolean; ids?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (body.deleteAll) {
    const result = await Notification.deleteMany({ recipient: session._id });
    return NextResponse.json({
      success: true,
      message: "All notifications deleted",
      data: { deleted: result.deletedCount || 0 },
    });
  }

  if (body.ids?.length) {
    const result = await Notification.deleteMany({
      _id: { $in: body.ids },
      recipient: session._id,
    });
    return NextResponse.json({
      success: true,
      message: "Notifications deleted",
      data: { deleted: result.deletedCount || 0 },
    });
  }

  return NextResponse.json({ success: false, error: "deleteAll or ids required" }, { status: 400 });
}
