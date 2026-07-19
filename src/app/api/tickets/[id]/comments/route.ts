export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Ticket from "@/lib/models/Ticket";
import { getSession } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";
import { sanitizeRichText } from "@/lib/sanitize-html";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const { id } = await params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 });
  }
  const { content, isPrivate, attachments } = await req.json();

  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ success: false, error: "Comment content is required" }, { status: 400 });
  }

  const ticket = await Ticket.findById(id);
  if (!ticket) return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 });

  // Access control: mirror the ticket GET scoping. Only a SuperAdmin, the
  // requester, the assigned technician/approver, or any Technician-type user
  // may comment. Auditors are read-only. Requesters cannot post private notes.
  const isRequester = ticket.requester?.toString() === session._id;
  const isTechAssignee = ticket.technician?.toString() === session._id;
  const isApprover = ticket.approver?.toString() === session._id;
  const isTechnicianType = session.userTypes.includes("Technician");
  const isAuditor = session.userTypes.includes("Auditor");

  if (session.role !== "SuperAdmin") {
    if (isAuditor) {
      return NextResponse.json({ success: false, error: "Auditors have read-only access" }, { status: 403 });
    }
    if (!isRequester && !isTechAssignee && !isApprover && !isTechnicianType) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
  }

  // Only staff (not a plain requester) may create internal/private comments.
  const wantsPrivate = Boolean(isPrivate);
  const canPostPrivate =
    session.role === "SuperAdmin" || isTechAssignee || isApprover || isTechnicianType;
  const commentIsPrivate = wantsPrivate && canPostPrivate;

  ticket.comments.push({
    author: session._id as unknown as import("mongoose").Types.ObjectId,
    content: sanitizeRichText(content),
    isPrivate: commentIsPrivate,
    attachments: attachments || [],
    createdAt: new Date(),
  });

  // A reply from anyone other than the requester counts as the first response
  // for the Respond SLA. Stamp it once so the respond clock stops.
  if (!ticket.slaRespondedAt && !isRequester) {
    ticket.slaRespondedAt = new Date();
  }

  await ticket.save();

  const notifyTarget = isRequester ? ticket.technician : ticket.requester;
  if (notifyTarget && !commentIsPrivate) {
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
