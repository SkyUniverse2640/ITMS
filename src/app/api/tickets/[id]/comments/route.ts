export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Ticket from "@/lib/models/Ticket";
import { getSession } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const { id } = await params;
  const { content, isPrivate, attachments } = await req.json();

  const ticket = await Ticket.findById(id);
  if (!ticket) return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 });

  ticket.comments.push({
    author: session._id as unknown as import("mongoose").Types.ObjectId,
    content,
    isPrivate: isPrivate || false,
    attachments: attachments || [],
    createdAt: new Date(),
  });

  await ticket.save();

  const notifyTarget =
    ticket.requester.toString() === session._id ? ticket.technician : ticket.requester;
  if (notifyTarget && !isPrivate) {
    await notifyUser({
      recipientId: String(notifyTarget),
      title: "New Comment",
      message: `New comment on ticket ${ticket.ticketNumber}`,
      type: "comment_added",
      link: `/tickets/${ticket._id}`,
    });
  }

  return NextResponse.json({ success: true, data: ticket.comments[ticket.comments.length - 1] }, { status: 201 });
}
