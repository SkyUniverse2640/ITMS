export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import type { Prisma, ApprovalStatus } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { notifyUser, resolveSlaNotifyRecipients, notifyUsers } from "@/lib/notify";
import { sendEmail } from "@/lib/send-email";
import { computeSlaDueDates, computeSlaFlags, getSlaEscalationRoles } from "@/lib/sla";
import {
  canTransitionStatus,
  isPendingApproval,
  normalizeStatusName,
} from "@/lib/ticket-status";
import { loadTicketDetail } from "@/lib/ticket-load";
import { serialize } from "@/lib/serialize";
import { escapeHtml, isId } from "@/lib/utils";

/** Resolve an included relation or a raw id to a string id */
function refId(ref: unknown): string {
  if (!ref) return "";
  if (typeof ref === "string") return ref;
  if (typeof ref === "object") {
    const o = ref as { _id?: unknown; id?: unknown };
    if (o.id != null) return String(o.id);
    if (o._id != null) return String(o._id);
  }
  return "";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    if (!isId(id)) {
      return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 });
    }

    const ticket = await loadTicketDetail(id);

    if (!ticket) {
      return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 });
    }

    // Re-evaluate binary SLA (OK/Breach) on read; persist only when it flips.
    const slaFlags = computeSlaFlags({
      slaRespondDueAt: ticket.slaRespondDueAt as string | undefined,
      slaDueAt: ticket.slaDueAt as string | undefined,
      slaRespondedAt: ticket.slaRespondedAt as string | undefined,
      resolvedAt: ticket.resolvedAt as string | undefined,
      closedAt: ticket.closedAt as string | undefined,
    });
    if (
      slaFlags.slaBreached !== Boolean(ticket.slaBreached) ||
      slaFlags.slaRespondBreached !== Boolean(ticket.slaRespondBreached)
    ) {
      await prisma.ticket.update({
        where: { id },
        data: {
          slaBreached: slaFlags.slaBreached,
          slaRespondBreached: slaFlags.slaRespondBreached,
        },
      });
    }
    ticket.slaBreached = slaFlags.slaBreached;
    ticket.slaRespondBreached = slaFlags.slaRespondBreached;

    if (session.role !== "SuperAdmin" && !session.userTypes.includes("Auditor")) {
      const isRequester = refId(ticket.requester) === session._id;
      const isTechAssignee = refId(ticket.technician) === session._id;
      const isApprover = refId(ticket.approver) === session._id;
      const isTechnicianType = session.userTypes.includes("Technician");

      if (!isRequester && !isTechAssignee && !isApprover && !isTechnicianType) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }

      if (isRequester && !isTechAssignee && !isApprover && !isTechnicianType) {
        const comments = Array.isArray(ticket.comments) ? ticket.comments : [];
        ticket.comments = comments.filter(
          (c) => !(c as { isPrivate?: boolean }).isPrivate
        );
      }
    }

    return NextResponse.json({ success: true, data: ticket });
  } catch (err) {
    console.error("GET /api/tickets/[id] failed:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load ticket" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  if (session.userTypes.includes("Auditor") && session.role !== "SuperAdmin") {
    return NextResponse.json({ success: false, error: "Auditors have read-only access" }, { status: 403 });
  }

  const { id } = await params;
  if (!isId(id)) {
    return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 });
  }
  const raw = await req.json();
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 });

  const isSuperAdmin = session.role === "SuperAdmin";

  // Access control: only SuperAdmin, the requester, the assigned technician,
  // the approver, or any Technician-type user may update this ticket.
  if (!isSuperAdmin) {
    const isRequester = ticket.requesterId === session._id;
    const isTechAssignee = ticket.technicianId === session._id;
    const isApproverOnTicket = ticket.approverId === session._id;
    const isTechnicianType = session.userTypes.includes("Technician");
    if (!isRequester && !isTechAssignee && !isApproverOnTicket && !isTechnicianType) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
  }
  const isTicketApprover = ticket.approverId === session._id;

  // Technicians may only change status / technician (+ approval actions & log message)
  // Priority and other fields are locked for non-SuperAdmin.
  let body: Record<string, unknown> = { ...raw };
  const logMessage =
    typeof raw.logMessage === "string" ? raw.logMessage.trim() : "";
  delete body.logMessage;

  if (!isSuperAdmin) {
    const allowed = new Set([
      "status",
      "technician",
      "approvalAction",
      "approvalStatus",
      "closureCode",
    ]);
    const filtered: Record<string, unknown> = {};
    for (const key of Object.keys(body)) {
      if (allowed.has(key)) filtered[key] = body[key];
    }
    body = filtered;

    // Only the assigned approver (or SuperAdmin) may approve/reject
    if (
      (body.approvalAction === "approve" || body.approvalAction === "reject") &&
      !isTicketApprover
    ) {
      return NextResponse.json(
        { success: false, error: "Only the assigned approver can approve/reject this ticket" },
        { status: 403 }
      );
    }
  }

  const before = {
    status: ticket.status,
    priority: ticket.priority,
    technician: ticket.technicianId ?? undefined,
    approvalStatus: ticket.approvalStatus ?? undefined,
  };

  const data: Prisma.TicketUncheckedUpdateInput = {};

  // Fields a SuperAdmin may set directly (never `logs` / `comments` / relations)
  const SCALAR_FIELDS = [
    "requestType",
    "impact",
    "urgency",
    "priority",
    "group",
    "department",
    "category",
    "subCategory",
    "project",
    "subject",
    "description",
    "closureCode",
    "resolutionNotes",
    "approvalLabel",
  ] as const;
  for (const key of SCALAR_FIELDS) {
    if (key in body) {
      (data as Record<string, unknown>)[key] = body[key];
    }
  }
  if ("attachments" in body && Array.isArray(body.attachments)) {
    data.attachments = body.attachments.map(String);
  }
  if ("technician" in body) {
    const t = body.technician ? String(body.technician) : "";
    data.technicianId = isId(t) ? t : null;
  }
  if ("approvalStatus" in body && typeof body.approvalStatus === "string") {
    const s = body.approvalStatus;
    if (s === "Pending" || s === "Approved" || s === "Rejected") {
      data.approvalStatus = s satisfies ApprovalStatus;
    }
  }

  let approvalAction: "approve" | "reject" | undefined;
  let nextStatusRaw: string | undefined =
    typeof body.status === "string" ? body.status : undefined;

  if (body.approvalAction === "approve") {
    approvalAction = "approve";
    data.approvalStatus = "Approved";
    nextStatusRaw = "Open";
    // SLA clock starts when work can begin: exclude the approval wait by
    // recomputing respond/resolve due dates from now on approve → Open.
    const { respondDueAt, resolveDueAt } = await computeSlaDueDates(ticket.priority);
    data.slaRespondDueAt = respondDueAt ?? null;
    data.slaDueAt = resolveDueAt ?? null;
  } else if (body.approvalAction === "reject") {
    approvalAction = "reject";
    data.approvalStatus = "Rejected";
    nextStatusRaw = "Reject";
    data.closedAt = new Date();
  }

  // Normalize + enforce status hierarchy
  if (nextStatusRaw && nextStatusRaw.trim()) {
    const normalized = normalizeStatusName(nextStatusRaw);
    const check = canTransitionStatus(ticket.status, normalized, { approvalAction });
    if (!check.ok) {
      return NextResponse.json({ success: false, error: check.error }, { status: 400 });
    }
    data.status = normalized;
    nextStatusRaw = normalized;
  } else if (approvalAction) {
    const check = canTransitionStatus(ticket.status, "", { approvalAction });
    if (!check.ok) {
      return NextResponse.json({ success: false, error: check.error }, { status: 400 });
    }
  }

  // While Pending Approval, block non-approval status changes
  if (
    isPendingApproval(ticket.status) &&
    !approvalAction &&
    nextStatusRaw &&
    nextStatusRaw !== "Pending Approval"
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Ticket is Pending Approval — status cannot change until approved",
      },
      { status: 400 }
    );
  }

  // Status change requires log message (except no-op same status)
  const nextStatus = nextStatusRaw || null;
  const statusChanging = !!nextStatus && nextStatus !== ticket.status;
  if (statusChanging && !logMessage && !approvalAction) {
    return NextResponse.json(
      {
        success: false,
        error: "Log message required when changing status",
      },
      { status: 400 }
    );
  }

  if (nextStatus === "Closed") {
    if (!ticket.closedAt) data.closedAt = new Date();
    if (!ticket.resolvedAt) data.resolvedAt = new Date();
  }
  if (nextStatus === "Reject" && !ticket.closedAt) {
    data.closedAt = new Date();
  }

  // Respond SLA stops at first technician engagement. "In Progress" (or any
  // forward move off Open by staff) is the first response; stamp it once.
  if (
    !ticket.slaRespondedAt &&
    nextStatus &&
    nextStatus !== "Pending Approval" &&
    nextStatus !== "Open" &&
    !approvalAction
  ) {
    data.slaRespondedAt = new Date();
  }

  const wasBreached = ticket.slaBreached;
  const prevStatus = ticket.status;
  const prevTech = ticket.technicianId ?? "";
  const resolvedStatus = nextStatus ?? ticket.status;
  const newTech =
    data.technicianId === undefined ? prevTech : ((data.technicianId as string | null) ?? "");

  // Re-evaluate binary SLA before persisting so a status/response change that
  // flips OK → Breach is saved and can trigger the breach notification below.
  const slaFlags = computeSlaFlags({
    slaRespondDueAt: (data.slaRespondDueAt as Date | null) ?? ticket.slaRespondDueAt,
    slaDueAt: (data.slaDueAt as Date | null) ?? ticket.slaDueAt,
    slaRespondedAt: (data.slaRespondedAt as Date | null) ?? ticket.slaRespondedAt,
    resolvedAt: (data.resolvedAt as Date | null) ?? ticket.resolvedAt,
    closedAt: (data.closedAt as Date | null) ?? ticket.closedAt,
  });
  data.slaRespondBreached = slaFlags.slaRespondBreached;
  data.slaBreached = slaFlags.slaBreached;

  // Build the activity log entries that accompany this update.
  const logs: Prisma.TicketLogCreateManyInput[] = [];

  if (statusChanging || approvalAction) {
    const action =
      approvalAction === "approve"
        ? "approved"
        : approvalAction === "reject"
          ? "rejected"
          : "status_changed";
    const msg =
      logMessage ||
      (approvalAction === "approve"
        ? `Ticket ${ticket.ticketNumber} was Approved by ${session.displayName}. Status set to Open.`
        : approvalAction === "reject"
          ? `Ticket ${ticket.ticketNumber} was Rejected by ${session.displayName}.`
          : `Status changed from ${prevStatus} to ${resolvedStatus} by ${session.displayName}`);
    logs.push({
      ticketId: id,
      actorId: session._id,
      actorName: session.displayName,
      actorEmail: session.email,
      action,
      message: msg,
      fromStatus: prevStatus,
      toStatus: resolvedStatus,
    });
  }

  if (prevTech !== newTech) {
    let assignedName = "Unassigned";
    if (newTech) {
      const u = await prisma.user.findUnique({
        where: { id: newTech },
        select: { displayName: true },
      });
      assignedName = u?.displayName || newTech;
    }
    logs.push({
      ticketId: id,
      actorId: session._id,
      actorName: session.displayName,
      actorEmail: session.email,
      action: "technician_changed",
      message: newTech
        ? `Technician assigned to ${assignedName} by ${session.displayName}`
        : `Technician unassigned by ${session.displayName}`,
    });
  }

  // Update and log together, so a log entry never survives a failed update.
  const updated = await prisma.$transaction(async (tx) => {
    const t = await tx.ticket.update({ where: { id }, data });
    if (logs.length) await tx.ticketLog.createMany({ data: logs });
    return t;
  });

  // Reload with relations for the response
  const populated = await loadTicketDetail(id);

  const link = `/tickets/${id}`;

  if (before.status !== updated.status) {
    const techUser = updated.technicianId
      ? await prisma.user.findUnique({
          where: { id: updated.technicianId },
          select: { displayName: true, email: true },
        })
      : null;
    const techName = techUser?.displayName || session.displayName;

    await notifyUser({
      recipientId: updated.requesterId,
      title: "Ticket Status Updated",
      message: `Your Ticket Status Has Changed from ${before.status} to ${updated.status}. This Changed by ${techName}. Click here to Monitor your Ticket.`,
      type: "status_changed",
      link,
    });

    // Email notification for status change
    const requesterUser = await prisma.user.findUnique({
      where: { id: updated.requesterId },
      select: { email: true, displayName: true },
    });
    if (requesterUser?.email) {
      sendEmail({
        to: requesterUser.email,
        subject: `Ticket ${escapeHtml(updated.ticketNumber)} Status Changed to ${escapeHtml(updated.status)}`,
        html: `
          <h2>Ticket Status Updated</h2>
          <p>Hi ${escapeHtml(requesterUser.displayName || "User")},</p>
          <p>Your Ticket Status Has Changed from <strong>${escapeHtml(before.status)}</strong> to <strong>${escapeHtml(updated.status)}</strong>.</p>
          <p>This Changed by <strong>${escapeHtml(techName)}</strong>.</p>
          <hr/>
          <h3>Ticket Log</h3>
          <ul>
            <li><strong>Ticket ID:</strong> ${escapeHtml(updated.ticketNumber)}</li>
            <li><strong>Subject:</strong> ${escapeHtml(updated.subject)}</li>
            <li><strong>Previous Status:</strong> ${escapeHtml(before.status)}</li>
            <li><strong>New Status:</strong> ${escapeHtml(updated.status)}</li>
            <li><strong>Priority:</strong> ${escapeHtml(updated.priority)}</li>
            <li><strong>Changed by:</strong> ${escapeHtml(techName)}</li>
            <li><strong>Changed at:</strong> ${new Date().toLocaleString()}</li>
          </ul>
          <p><a href="${escapeHtml(process.env.NEXT_PUBLIC_APP_URL || "")}${escapeHtml(link)}">Click here to Monitor your Ticket</a></p>
        `,
      }).catch(() => {});
    }
  }

  if (approvalAction === "approve" || approvalAction === "reject") {
    await notifyUser({
      recipientId: updated.requesterId,
      title: approvalAction === "approve" ? "Ticket Approved" : "Ticket Rejected",
      message: `Ticket ${updated.ticketNumber} was ${
        approvalAction === "approve" ? "approved" : "rejected"
      }`,
      type: "approval_decision",
      link,
    });
  }

  if (before.technician !== (updated.technicianId ?? undefined) && updated.technicianId) {
    await notifyUser({
      recipientId: updated.technicianId,
      title: "Ticket Assigned to You",
      message: `Ticket ${updated.ticketNumber}: ${updated.subject}`,
      type: "ticket_assigned",
      link,
    });
  }

  // SLA breach just flipped true → notify department labels from SLA escalation
  if (!wasBreached && updated.slaBreached) {
    const { escalation } = await getSlaEscalationRoles(updated.priority);
    const rolesAtBreach = new Set<string>();
    for (const e of escalation) {
      if (e.percentage >= 75) {
        for (const r of e.notifyRoles || []) rolesAtBreach.add(r);
      }
    }
    if (rolesAtBreach.size === 0) {
      rolesAtBreach.add("Manager");
      rolesAtBreach.add("SuperAdmin");
    }
    const recipients = await resolveSlaNotifyRecipients({
      departmentName: updated.department || updated.group || "",
      notifyRoles: [...rolesAtBreach],
      technicianId: updated.technicianId,
    });
    await notifyUsers(recipients, {
      title: "SLA Breach",
      message: `Ticket ${updated.ticketNumber} has breached SLA: ${updated.subject}`,
      type: "sla_breach",
      link,
    });
  }

  await createAuditLog({
    actorId: session._id,
    actorName: session.displayName,
    action: "Update",
    module: "Ticket",
    targetId: id,
    targetLabel: updated.ticketNumber,
    before,
    after: {
      status: updated.status,
      priority: updated.priority,
      technician: updated.technicianId ?? undefined,
      approvalStatus: updated.approvalStatus ?? undefined,
      slaBreached: updated.slaBreached,
    },
  });

  return NextResponse.json({ success: true, data: populated || serialize(updated) });
}
