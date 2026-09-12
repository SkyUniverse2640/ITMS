export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { generateTicketNumberForType } from "@/lib/ticket-number";
import { notifyUser, notifyUsers } from "@/lib/notify";
import { sendEmail } from "@/lib/send-email";
import { computeSlaDueDates, computeSlaFlags, derivePriorityFromMatrix } from "@/lib/sla";
import { serialize } from "@/lib/serialize";
import { escapeHtml, isId } from "@/lib/utils";
import { sanitizeRichText } from "@/lib/sanitize-html";
import { isUniqueViolation, isForeignKeyViolation } from "@/lib/prisma-errors";

/** Requester / technician summary for the ticket list. */
const LIST_USER_REF = { id: true, displayName: true, email: true } as const;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "20"));
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "";
  const priority = url.searchParams.get("priority") || "";
  const technician = url.searchParams.get("technician") || "";
  const requester = url.searchParams.get("requester") || "";
  const view = url.searchParams.get("view") || "";

  const where: Prisma.TicketWhereInput = {};
  const scopes: Prisma.TicketWhereInput[] = [];

  if (session.role !== "SuperAdmin") {
    const isAuditor = session.userTypes.includes("Auditor");
    if (!isAuditor) {
      const isTechnician = session.userTypes.includes("Technician");
      const isApprover = session.userTypes.includes("Approver");
      if (view === "my") {
        where.requesterId = session._id;
      } else if (view === "assigned") {
        where.technicianId = session._id;
      } else if (view === "approvals") {
        // Tickets waiting for this user as approver
        where.approverId = session._id;
        where.approvalStatus = "Pending";
      } else if (isTechnician || isApprover) {
        scopes.push({
          OR: [
            { requesterId: session._id },
            { technicianId: session._id },
            { approverId: session._id },
          ],
        });
      } else {
        where.requesterId = session._id;
      }
    }
  } else if (view === "approvals") {
    where.approvalStatus = "Pending";
  }

  if (search) {
    const like = { contains: search, mode: "insensitive" } as const;
    scopes.push({
      OR: [{ ticketNumber: like }, { subject: like }, { requesterName: like }],
    });
  }
  if (status) where.status = status;
  if (priority) where.priority = priority;
  // Caller-supplied ids go through AND so they can only narrow the visibility
  // scope set above, never replace it. A malformed id matches nothing.
  if (technician) {
    scopes.push({ technicianId: isId(technician) ? technician : { in: [] } });
  }
  if (requester) {
    scopes.push({ requesterId: isId(requester) ? requester : { in: [] } });
  }
  if (scopes.length) where.AND = scopes;

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        technician: { select: LIST_USER_REF },
        requester: { select: LIST_USER_REF },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.ticket.count({ where }),
  ]);

  // SLA is derived, not a stored fact: re-evaluate OK/Breach on read so open
  // tickets reflect the current clock. Persist only when a flag actually flips
  // (keeps the stored value truthful for reports without a write per read).
  const now = new Date();
  const flips: { id: string; slaBreached: boolean; slaRespondBreached: boolean }[] = [];
  for (const t of tickets) {
    const flags = computeSlaFlags({
      slaRespondDueAt: t.slaRespondDueAt,
      slaDueAt: t.slaDueAt,
      slaRespondedAt: t.slaRespondedAt,
      resolvedAt: t.resolvedAt,
      closedAt: t.closedAt,
      now,
    });
    if (
      flags.slaBreached !== t.slaBreached ||
      flags.slaRespondBreached !== t.slaRespondBreached
    ) {
      flips.push({ id: t.id, ...flags });
    }
    t.slaBreached = flags.slaBreached;
    t.slaRespondBreached = flags.slaRespondBreached;
  }
  if (flips.length > 0) {
    await Promise.all(
      flips.map((f) =>
        prisma.ticket.update({
          where: { id: f.id },
          data: { slaBreached: f.slaBreached, slaRespondBreached: f.slaRespondBreached },
        })
      )
    );
  }

  return NextResponse.json({
    success: true,
    data: serialize(tickets),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Sanitize approver id (must be a real id)
  const rawApprover =
    typeof body.approver === "string"
      ? body.approver.trim()
      : body.approver
        ? String(body.approver)
        : "";
  const approverId = isId(rawApprover) ? rawApprover : "";

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

  const relatedAssetIds = Array.isArray(body.relatedAssets)
    ? [
        ...new Set(
          (body.relatedAssets as unknown[]).map((a) => String(a)).filter((a) => isId(a))
        ),
      ]
    : [];

  const technicianId =
    body.technician && isId(String(body.technician)) ? String(body.technician) : undefined;

  // Clean payload — do not spread raw body (injects junk fields)
  const createData = {
    requestType,
    status,
    impact,
    urgency,
    priority,
    department,
    group: department,
    category: typeof body.category === "string" ? body.category : undefined,
    subCategory: typeof body.subCategory === "string" ? body.subCategory : undefined,
    project: typeof body.project === "string" ? body.project : undefined,
    subject,
    description: typeof body.description === "string" ? sanitizeRichText(body.description) : "",
    requesterId: session._id,
    requesterName: session.displayName,
    requesterEmail: session.email,
    attachments: Array.isArray(body.attachments) ? body.attachments.map(String) : [],
    approvalStatus: approverId ? ("Pending" as const) : undefined,
    approvalLabel,
    approverId: approverId || undefined,
    technicianId,
    slaDueAt: resolveDueAt || undefined,
    slaRespondDueAt: respondDueAt || undefined,
    relatedAssets: relatedAssetIds.length
      ? { create: relatedAssetIds.map((assetId) => ({ assetId })) }
      : undefined,
    // ticketNumber is added per attempt in the retry loop below.
  } satisfies Omit<Prisma.TicketUncheckedCreateInput, "ticketNumber">;

  // Retry on rare ticketNumber collision under concurrent creates
  let ticket: Awaited<ReturnType<typeof prisma.ticket.create>> | null = null;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const ticketNumber = await generateTicketNumberForType(requestType);
    try {
      ticket = await prisma.ticket.create({
        data: {
          ...createData,
          ticketNumber,
          logs: {
            create: [
              {
                actorId: session._id,
                actorName: session.displayName,
                actorEmail: session.email,
                action: "created",
                message: `This Ticket ${ticketNumber} Was Created by ${session.displayName} ${session.email}`,
                toStatus: status,
              },
            ],
          },
        },
      });
      break;
    } catch (err) {
      lastErr = err;
      if (isForeignKeyViolation(err)) {
        // A supplied approver / technician / asset id no longer exists.
        return NextResponse.json(
          {
            success: false,
            error:
              "Approver, technician, or related asset no longer exists. Reload the page and try again.",
          },
          { status: 400 }
        );
      }
      if (!isUniqueViolation(err, "ticket_number")) {
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

  const ticketId = ticket.id;
  const link = `/tickets/${ticketId}`;

  // Notifications must not fail the create response
  try {
    await notifyUser({
      recipientId: session._id,
      title: "Ticket Created",
      message: `Your Ticket With Requests ID: ${ticket.ticketNumber} Successfully Created. And now, Status: ${ticket.status}. Click here to Monitor your Ticket.`,
      type: "ticket_created",
      link,
    });

    // Email notification
    const requesterUser = await prisma.user.findUnique({
      where: { id: session._id },
      select: { email: true, displayName: true },
    });
    if (requesterUser?.email) {
      sendEmail({
        to: requesterUser.email,
        subject: `Ticket ${escapeHtml(ticket.ticketNumber)} Created Successfully`,
        html: `
          <h2>Ticket Created</h2>
          <p>Hi ${escapeHtml(requesterUser.displayName || "User")},</p>
          <p>Your Ticket With Requests ID: <strong>${escapeHtml(ticket.ticketNumber)}</strong> Successfully Created.</p>
          <p>Status: <strong>${escapeHtml(ticket.status)}</strong></p>
          <p>Subject: ${escapeHtml(ticket.subject)}</p>
          <hr/>
          <h3>Ticket Log</h3>
          <ul>
            <li><strong>Created:</strong> ${new Date().toLocaleString()}</li>
            <li><strong>Priority:</strong> ${escapeHtml(ticket.priority)}</li>
            <li><strong>Category:</strong> ${escapeHtml(ticket.category || "—")}</li>
            <li><strong>Status:</strong> ${escapeHtml(ticket.status)}</li>
          </ul>
          <p><a href="${escapeHtml(process.env.NEXT_PUBLIC_APP_URL || "")}${escapeHtml(link)}">Click here to Monitor your Ticket</a></p>
        `,
      }).catch(() => {});
    }
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
      const catSetting = await prisma.settings.findUnique({ where: { key: "ticketCategories" } });
      const cats = Array.isArray(catSetting?.value) ? catSetting.value : [];
      const cat = cats.find(
        (x: unknown) =>
          x &&
          typeof x === "object" &&
          String((x as { name?: string }).name || "").toLowerCase() === categoryName.toLowerCase()
      ) as { members?: unknown } | undefined;
      const memberIds = Array.isArray(cat?.members)
        ? cat.members.map((id) => String(id)).filter(Boolean)
        : [];
      const skip = new Set([session._id, approverId].filter(Boolean));
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

  return NextResponse.json({ success: true, data: serialize(ticket) }, { status: 201 });
}
