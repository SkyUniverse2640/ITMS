export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Ticket from "@/lib/models/Ticket";
import User from "@/lib/models/User";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { notifyUser, resolveSlaNotifyRecipients, notifyUsers } from "@/lib/notify";
import { computeSlaDueDates, computeSlaFlags, getSlaEscalationRoles } from "@/lib/sla";
import {
  canTransitionStatus,
  isPendingApproval,
  normalizeStatusName,
} from "@/lib/ticket-status";
import { loadTicketDetail } from "@/lib/ticket-load";

/** Resolve populated ref or raw ObjectId to string id */
function refId(ref: unknown): string {
  if (!ref) return "";
  if (typeof ref === "string") return ref;
  if (typeof ref === "object") {
    const o = ref as { _id?: unknown; id?: unknown };
    if (o._id != null) return String(o._id);
    if (o.id != null) return String(o.id);
  }
  try {
    return String(ref);
  } catch {
    return "";
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 });
    }

    // NEVER use mongoose .populate() here — it broke Safari/mobile with:
    // StrictPopulateError: Cannot populate path `logs.actor`
    const ticket = await loadTicketDetail(id);

    if (!ticket) {
      return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 });
    }

    // Re-evaluate binary SLA (OK/Breach) on read; persist only when it flips.
    const slaFlags = computeSlaFlags({
      slaRespondDueAt: ticket.slaRespondDueAt as Date | undefined,
      slaDueAt: ticket.slaDueAt as Date | undefined,
      slaRespondedAt: ticket.slaRespondedAt as Date | undefined,
      resolvedAt: ticket.resolvedAt as Date | undefined,
      closedAt: ticket.closedAt as Date | undefined,
    });
    if (
      slaFlags.slaBreached !== Boolean(ticket.slaBreached) ||
      slaFlags.slaRespondBreached !== Boolean(ticket.slaRespondBreached)
    ) {
      await Ticket.updateOne(
        { _id: id },
        { $set: { slaBreached: slaFlags.slaBreached, slaRespondBreached: slaFlags.slaRespondBreached } }
      );
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

  await connectDB();
  const { id } = await params;
  const raw = await req.json();
  const ticket = await Ticket.findById(id);
  if (!ticket) return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 });

  const isSuperAdmin = session.role === "SuperAdmin";
  const ticketApproverId = ticket.approver ? String(ticket.approver) : "";
  const isTicketApprover = ticketApproverId === session._id;

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
    technician: ticket.technician?.toString(),
    approvalStatus: ticket.approvalStatus,
  };

  let approvalAction: "approve" | "reject" | undefined;
  if (body.approvalAction === "approve") {
    approvalAction = "approve";
    body.approvalStatus = "Approved";
    body.status = "Open";
    // SLA clock starts when work can begin: exclude the approval wait by
    // recomputing respond/resolve due dates from now on approve → Open.
    const { respondDueAt, resolveDueAt } = await computeSlaDueDates(ticket.priority);
    body.slaRespondDueAt = respondDueAt || undefined;
    body.slaDueAt = resolveDueAt || undefined;
  } else if (body.approvalAction === "reject") {
    approvalAction = "reject";
    body.approvalStatus = "Rejected";
    body.status = "Reject";
    body.closedAt = new Date();
  }
  delete body.approvalAction;

  // Normalize + enforce status hierarchy
  if (typeof body.status === "string" && body.status.trim()) {
    body.status = normalizeStatusName(body.status);
    const check = canTransitionStatus(ticket.status, body.status as string, {
      approvalAction,
    });
    if (!check.ok) {
      return NextResponse.json({ success: false, error: check.error }, { status: 400 });
    }
  } else if (approvalAction) {
    const check = canTransitionStatus(ticket.status, body.status as string, { approvalAction });
    if (!check.ok) {
      return NextResponse.json({ success: false, error: check.error }, { status: 400 });
    }
  }

  // While Pending Approval, block non-approval field status changes
  if (
    isPendingApproval(ticket.status) &&
    !approvalAction &&
    body.status &&
    normalizeStatusName(body.status as string) !== "Pending Approval"
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
  const nextStatus =
    typeof body.status === "string" ? normalizeStatusName(body.status) : null;
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

  if (body.status === "Closed" && !ticket.closedAt) {
    body.closedAt = new Date();
  }
  if (body.status === "Closed" && !ticket.resolvedAt) {
    body.resolvedAt = new Date();
  }
  if (body.status === "Reject" && !ticket.closedAt) {
    body.closedAt = new Date();
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
    body.slaRespondedAt = new Date();
  }

  const wasBreached = ticket.slaBreached;
  const prevStatus = ticket.status;
  const prevTech = ticket.technician?.toString() || "";

  // Don't allow clients to overwrite logs array directly
  delete body.logs;
  delete body.comments;

  Object.assign(ticket, body);

  // Append activity logs
  if (!Array.isArray(ticket.logs)) ticket.logs = [];

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
          : `Status changed from ${prevStatus} to ${ticket.status} by ${session.displayName}`);
    ticket.logs.push({
      actor: session._id as unknown as import("mongoose").Types.ObjectId,
      actorName: session.displayName,
      actorEmail: session.email,
      action,
      message: msg,
      fromStatus: prevStatus,
      toStatus: ticket.status,
    });
  }

  const newTech = ticket.technician?.toString() || "";
  if (prevTech !== newTech) {
    let assignedName = "Unassigned";
    if (newTech) {
      const u = await User.findById(newTech).select("displayName email").lean();
      assignedName = u?.displayName || newTech;
    }
    ticket.logs.push({
      actor: session._id as unknown as import("mongoose").Types.ObjectId,
      actorName: session.displayName,
      actorEmail: session.email,
      action: "technician_changed",
      message: newTech
        ? `Technician assigned to ${assignedName} by ${session.displayName}`
        : `Technician unassigned by ${session.displayName}`,
    });
  }

  // Re-evaluate binary SLA before persisting so a status/response change that
  // flips OK → Breach is saved and can trigger the breach notification below.
  const slaFlags = computeSlaFlags({
    slaRespondDueAt: ticket.slaRespondDueAt,
    slaDueAt: ticket.slaDueAt,
    slaRespondedAt: ticket.slaRespondedAt,
    resolvedAt: ticket.resolvedAt,
    closedAt: ticket.closedAt,
  });
  ticket.slaRespondBreached = slaFlags.slaRespondBreached;
  ticket.slaBreached = slaFlags.slaBreached;

  await ticket.save();

  // Safe reload without mongoose populate (mobile/Safari was hitting StrictPopulateError)
  const populated = await loadTicketDetail(String(ticket._id));

  const link = `/tickets/${ticket._id}`;

  if (before.status !== ticket.status) {
    await notifyUser({
      recipientId: String(ticket.requester),
      title: "Ticket Status Updated",
      message: logMessage
        ? logMessage.slice(0, 280)
        : `Ticket ${ticket.ticketNumber} status changed to ${ticket.status}`,
      type: "status_changed",
      link,
    });
  }

  if (approvalAction === "approve" || approvalAction === "reject") {
    await notifyUser({
      recipientId: String(ticket.requester),
      title: approvalAction === "approve" ? "Ticket Approved" : "Ticket Rejected",
      message: `Ticket ${ticket.ticketNumber} was ${
        approvalAction === "approve" ? "approved" : "rejected"
      }`,
      type: "approval_decision",
      link,
    });
  }

  if (before.technician !== ticket.technician?.toString() && ticket.technician) {
    await notifyUser({
      recipientId: String(ticket.technician),
      title: "Ticket Assigned to You",
      message: `Ticket ${ticket.ticketNumber}: ${ticket.subject}`,
      type: "ticket_assigned",
      link,
    });
  }

  // SLA breach just flipped true → notify department labels from SLA escalation
  if (!wasBreached && ticket.slaBreached) {
    const { escalation } = await getSlaEscalationRoles(ticket.priority);
    const rolesAtBreach = new Set<string>();
    for (const e of escalation) {
      if (e.percentage >= 100 || e.percentage >= 75) {
        for (const r of e.notifyRoles || []) rolesAtBreach.add(r);
      }
    }
    if (rolesAtBreach.size === 0) {
      rolesAtBreach.add("Manager");
      rolesAtBreach.add("SuperAdmin");
    }
    const recipients = await resolveSlaNotifyRecipients({
      departmentName: ticket.department || ticket.group || "",
      notifyRoles: [...rolesAtBreach],
      technicianId: ticket.technician?.toString(),
    });
    await notifyUsers(recipients, {
      title: "SLA Breach",
      message: `Ticket ${ticket.ticketNumber} has breached SLA: ${ticket.subject}`,
      type: "sla_breach",
      link,
    });
  }

  await createAuditLog({
    actorId: session._id,
    actorName: session.displayName,
    action: "Update",
    module: "Ticket",
    targetId: ticket._id.toString(),
    targetLabel: ticket.ticketNumber,
    before,
    after: {
      status: ticket.status,
      priority: ticket.priority,
      technician: ticket.technician?.toString(),
      approvalStatus: ticket.approvalStatus,
      slaBreached: ticket.slaBreached,
    },
  });

  return NextResponse.json({ success: true, data: populated || ticket });
}
