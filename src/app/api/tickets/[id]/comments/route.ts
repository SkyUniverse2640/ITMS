export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";
import { sanitizeRichText } from "@/lib/sanitize-html";
import { serialize } from "@/lib/serialize";
import { isId } from "@/lib/utils";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isId(id)) {
    return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 });
  }
  const { content, isPrivate, attachments } = await req.json();

  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ success: false, error: "Comment content is required" }, { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 });

  // Access control: mirror the ticket GET scoping. Only a SuperAdmin, the
  // requester, the assigned technician/approver, or any Technician-type user
  // may comment. Auditors are read-only. Requesters cannot post private notes.
  const isRequester = ticket.requesterId === session._id;
  const isTechAssignee = ticket.technicianId === session._id;
  const isApprover = ticket.approverId === session._id;
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

  // A reply from anyone other than the requester counts as the first response
  // for the Respond SLA. Stamp it once so the respond clock stops.
  const stampResponse = !ticket.slaRespondedAt && !isRequester;

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.ticketComment.create({
      data: {
        ticketId: id,
        authorId: session._id,
        content: sanitizeRichText(content),
        isPrivate: commentIsPrivate,
        attachments: Array.isArray(attachments) ? attachments.map(String) : [],
      },
    });
    if (stampResponse) {
      await tx.ticket.update({
        where: { id },
        data: { slaRespondedAt: new Date() },
      });
    }
    return created;
  });

  const notifyTarget = isRequester ? ticket.technicianId : ticket.requesterId;
  if (notifyTarget && !commentIsPrivate) {
    await notifyUser({
      recipientId: notifyTarget,
      title: "New Comment",
      message: `New comment on ticket ${ticket.ticketNumber}`,
      type: "comment_added",
      link: `/tickets/${id}`,
    });
  }

  return NextResponse.json({ success: true, data: serialize(comment) }, { status: 201 });
}
