export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { serialize } from "@/lib/serialize";
import { isId } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const unreadOnly = url.searchParams.get("unread") === "true";

  const where: Prisma.NotificationWhereInput = { recipientId: session._id };
  if (unreadOnly) where.read = false;

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({ where: { recipientId: session._id, read: false } }),
  ]);

  return NextResponse.json({ success: true, data: serialize(notifications), unreadCount });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { ids, markAll } = await req.json();

  if (markAll) {
    await prisma.notification.updateMany({
      where: { recipientId: session._id, read: false },
      data: { read: true },
    });
  } else if (Array.isArray(ids) && ids.length) {
    await prisma.notification.updateMany({
      where: { id: { in: ids.map(String).filter(isId) }, recipientId: session._id },
      data: { read: true },
    });
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

  let body: { deleteAll?: boolean; ids?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (body.deleteAll) {
    const result = await prisma.notification.deleteMany({
      where: { recipientId: session._id },
    });
    return NextResponse.json({
      success: true,
      message: "All notifications deleted",
      data: { deleted: result.count },
    });
  }

  if (body.ids?.length) {
    const result = await prisma.notification.deleteMany({
      where: {
        id: { in: body.ids.map(String).filter(isId) },
        recipientId: session._id,
      },
    });
    return NextResponse.json({
      success: true,
      message: "Notifications deleted",
      data: { deleted: result.count },
    });
  }

  return NextResponse.json({ success: false, error: "deleteAll or ids required" }, { status: 400 });
}
