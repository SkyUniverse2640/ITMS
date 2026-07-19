export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Ticket from "@/lib/models/Ticket";
// Register models used by populate
import "@/lib/models/User";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { generateTicketNumberForType } from "@/lib/ticket-number";
import { notifyUser, notifyUsers } from "@/lib/notify";
import { computeSlaDueDates, computeSlaFlags, derivePriorityFromMatrix } from "@/lib/sla";
import { Settings } from "@/lib/models/Settings";
import { escapeRegex } from "@/lib/utils";
import { sanitizeRichText } from "@/lib/sanitize-html";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "20"));
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "";
  const priority = url.searchParams.get("priority") || "";
  const technician = url.searchParams.get("technician") || "";
  const requester = url.searchParams.get("requester") || "";
  const view = url.searchParams.get("view") || "";

  const filter: Record<string, unknown> = {};

  if (session.role !== "SuperAdmin") {
    const isAuditor = session.userTypes.includes("Auditor");
    if (!isAuditor) {
      const isTechnician = session.userTypes.includes("Technician");
      const isApprover = session.userTypes.includes("Approver");
      if (view === "my") {
        filter.requester = session._id;
      } else if (view === "assigned") {
        filter.technician = session._id;
      } else if (view === "approvals") {
        // Tickets waiting for this user as approver
        filter.approver = session._id;
        filter.approvalStatus = "Pending";
      } else if (isTechnician || isApprover) {
        filter.$or = [
          { requester: session._id },
          { technician: session._id },
          { approver: session._id },
        ];
      } else {
        filter.requester = session._id;
      }
    }
  } else if (view === "approvals") {
    filter.approvalStatus = "Pending";
  }

  if (search) {
    const escaped = escapeRegex(search);
    const searchClause = {
      $or: [
        { ticketNumber: { $regex: escaped, $options: "i" } },
        { subject: { $regex: escaped, $options: "i" } },
        { requesterName: { $regex: escaped, $options: "i" } },
      ],
    };
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or as unknown[] }, searchClause];
      delete filter.$or;
    } else {
      Object.assign(filter, searchClause);
    }
  }
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (technician) filter.technician = technician;
  if (requester) filter.requester = requester;

  const [tickets, total] = await Promise.all([
    Ticket.find(filter)
      .populate("technician", "displayName")
      .populate("requester", "displayName email")
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Ticket.countDocuments(filter),
  ]);

  // SLA is derived, not a stored fact: re-evaluate OK/Breach on read so open
  // tickets reflect the current clock. Persist only when a flag actually flips
  // (keeps the stored value truthful for reports without a write per read).
  const now = new Date();
  const flips: { id: string; slaBreached: boolean; slaRespondBreached: boolean }[] = [];
  for (const raw of tickets) {
    const t = raw as unknown as Record<string, unknown>;
    const flags = computeSlaFlags({
      slaRespondDueAt: t.slaRespondDueAt as Date | undefined,
      slaDueAt: t.slaDueAt as Date | undefined,
      slaRespondedAt: t.slaRespondedAt as Date | undefined,
      resolvedAt: t.resolvedAt as Date | undefined,
      closedAt: t.closedAt as Date | undefined,
      now,
    });
    if (
      flags.slaBreached !== Boolean(t.slaBreached) ||
      flags.slaRespondBreached !== Boolean(t.slaRespondBreached)
    ) {
      flips.push({ id: String(t._id), ...flags });
    }
    t.slaBreached = flags.slaBreached;
    t.slaRespondBreached = flags.slaRespondBreached;
  }
  if (flips.length > 0) {
    await Promise.all(
      flips.map((f) =>
        Ticket.updateOne(
          { _id: f.id },
          { $set: { slaBreached: f.slaBreached, slaRespondBreached: f.slaRespondBreached } }
        )
      )
    );
  }

  return NextResponse.json({
    success: true,
    data: tickets,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const body = await req.json();

  // Sanitize approver id (must be valid ObjectId)
  const rawApprover =
    typeof body.approver === "string"
      ? body.approver.trim()
      : body.approver
        ? String(body.approver)
        : "";
  const approverId =
    rawApprover && mongoose.Types.ObjectId.isValid(rawApprover) ? rawApprover : "";

  // Status: need approval → Pending Approval, else Open
  const status = approverId ? "Pending Approval" : "Open";

  const department =
    (typeof body.department === "string" && body.department.trim()) ||
    (typeof body.group === "string" && body.group.trim()) ||
    "IT";

  const requestType =
    (typeof body.requestType === "string" && body.requestType.trim()) || "Incident";

  const impact =
    (typeof body.impact === "string" && body.impact.trim()) || "Normal";

  const urgency =
    (typeof body.urgency === "string" && body.urgency.trim()) || "Normal";

  const priority = await derivePriorityFromMatrix(impact, urgency);
  const { respondDueAt, resolveDueAt } = await computeSlaDueDates(priority);

  const approvalLabel =
    typeof body.approvalLabel === "string" && body.approvalLabel.trim()
      ? body.approvalLabel.trim()
      : undefined;

  const subject =
    typeof body.subject === "string" ? body.subject.trim() : "";
  if (!subject) {
    return NextResponse.json({ success: false, error: "Subject required" }, { status: 400 });
  }

  // Clean payload — do not spread raw body (breaks casts / injects junk fields)
  const createPayload: Record<string, unknown> = {
    requestType,
    status,
    impact,
    urgency: urgency,
    priority,
    department,
    group: department,
    category: typeof body.category === "string" ? body.category : undefined,
    subCategory: typeof body.subCategory === "string" ? body.subCategory : undefined,
    project: typeof body.project === "string" ? body.project : undefined,
    subject,
    description: typeof body.description === "string" ? sanitizeRichText(body.description) : "",
    requester: session._id,
    requesterName: session.displayName,
    requesterEmail: session.email,
    relatedAssets: Array.isArray(body.relatedAssets) ? body.relatedAssets : [],
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
    approvalStatus: approverId ? "Pending" : undefined,
    approvalLabel,
    slaDueAt: resolveDueAt || undefined,
    slaRespondDueAt: respondDueAt || undefined,
  };
  if (approverId) createPayload.approver = approverId;
  if (body.technician && mongoose.Types.ObjectId.isValid(String(body.technician))) {
    createPayload.technician = String(body.technician);
  }

  // Retry on rare ticketNumber collision under concurrent creates
  let ticket = null;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const ticketNumber = await generateTicketNumberForType(requestType);
      ticket = await Ticket.create({
        ...createPayload,
        ticketNumber,
        logs: [
          {
            actor: session._id,
            actorName: session.displayName,
            actorEmail: session.email,
            action: "created",
            message: `This Ticket ${ticketNumber} Was Created by ${session.displayName} ${session.email}`,
            toStatus: status,
          },
        ],
      });
      break;
    } catch (err) {
      lastErr = err;
      const msg = String((err as { code?: number; message?: string })?.message || "");
      const isDup =
        (err as { code?: number })?.code === 11000 || /duplicate|E11000/i.test(msg);
      if (!isDup) {
        console.error("Ticket create error:", err);
        throw err;
      }
    }
  }
  if (!ticket) {
    console.error("Ticket create failed after retries:", lastErr);
    return NextResponse.json(
      { success: false, error: "Failed to allocate ticket number" },
      { status: 500 }
    );
  }

  const ticketId = String(ticket._id);
  const link = `/tickets/${ticketId}`;

  // Notifications must not fail the create response
  try {
    await notifyUser({
      recipientId: session._id,
      title: "Ticket Created",
      message: `Your ticket ${ticket.ticketNumber} was created successfully: ${ticket.subject}`,
      type: "ticket_created",
      link,
    });
  } catch (e) {
    console.error("Notify requester failed:", e);
  }

  if (approverId) {
    try {
      const ok = await notifyUser({
        recipientId: approverId,
        title: "Approval Requested",
        message: `Ticket ${ticket.ticketNumber} needs your approval${
          approvalLabel ? ` (${approvalLabel})` : ""
        }`,
        type: "approval_requested",
        link,
      });
      if (!ok) console.error("Approver notification not created for", approverId);
    } catch (e) {
      console.error("Notify approver failed:", e);
    }
  }

  // Category handlers only (Ticket Template → Category → Handlers & notifications)
  const categoryName =
    typeof body.category === "string" ? body.category.trim() : String(ticket.category || "").trim();
  if (categoryName) {
    try {
      const catSetting = await Settings.findOne({ key: "ticketCategories" }).lean();
      const cats = Array.isArray(catSetting?.value) ? catSetting.value : [];
      const cat = cats.find(
        (x: unknown) =>
          x &&
          typeof x === "object" &&
          String((x as { name?: string }).name || "").toLowerCase() === categoryName.toLowerCase()
      ) as { members?: unknown } | undefined;
      const memberIds = Array.isArray(cat?.members)
        ? cat!.members!.map((id) => String(id)).filter(Boolean)
        : [];
      const skip = new Set([String(session._id), approverId].filter(Boolean));
      const toNotify = memberIds.filter((id) => !skip.has(id));
      if (toNotify.length > 0) {
        await notifyUsers(toNotify, {
          title: "New Ticket in Category",
          message: `${ticket.ticketNumber} [${categoryName}]: ${ticket.subject}`,
          type: "ticket_created",
          link,
        });
      }
    } catch (err) {
      console.error("Category member notify failed:", err);
    }
  }

  await createAuditLog({
    actorId: session._id,
    actorName: session.displayName,
    action: "Create",
    module: "Ticket",
    targetId: ticketId,
    targetLabel: ticket.ticketNumber,
    after: {
      subject: ticket.subject,
      priority: ticket.priority,
      status: ticket.status,
      approvalLabel: approvalLabel || null,
      approver: approverId || null,
    },
  });

  return NextResponse.json({ success: true, data: ticket }, { status: 201 });
}
