export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { serialize } from "@/lib/serialize";
import { isForeignKeyViolation } from "@/lib/prisma-errors";
import { isId } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50"));
  const status = url.searchParams.get("status") || "";
  const ticketId = url.searchParams.get("ticketId") || "";
  const view = url.searchParams.get("view") || "";

  const where: Prisma.TaskWhereInput = {};
  if (view === "my" || session.role !== "SuperAdmin") where.assigneeId = session._id;
  if (status) where.status = status;
  if (ticketId) where.relatedTicketId = isId(ticketId) ? ticketId : { in: [] };

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, displayName: true } },
        relatedTicket: { select: { id: true, ticketNumber: true, subject: true } },
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.task.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: serialize(tasks),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });
  }

  if (body.assignee && !isId(String(body.assignee))) {
    return NextResponse.json({ success: false, error: "Invalid assignee" }, { status: 400 });
  }

  if (body.dateStart && body.dateEnd && new Date(body.dateStart) >= new Date(body.dateEnd)) {
    return NextResponse.json({ success: false, error: "Date Start must be before Date End" }, { status: 400 });
  }

  const checklist = Array.isArray(body.checklist)
    ? body.checklist
        .filter((c: unknown) => c && typeof c === "object")
        .map((c: { item?: unknown; done?: unknown }) => ({
          item: String(c.item ?? ""),
          done: Boolean(c.done),
        }))
        .filter((c: { item: string }) => c.item)
    : [];

  let task;
  try {
    task = await prisma.task.create({
      data: {
        title: body.title.trim(),
        description: typeof body.description === "string" ? body.description : "",
        status: typeof body.status === "string" && body.status ? body.status : "To Do",
        priority: typeof body.priority === "string" ? body.priority : "Normal",
        assigneeId: body.assignee ? String(body.assignee) : session._id,
        dateStart: body.dateStart ? new Date(body.dateStart) : undefined,
        dateEnd: body.dateEnd ? new Date(body.dateEnd) : undefined,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        relatedTicketId: isId(String(body.relatedTicket)) ? String(body.relatedTicket) : undefined,
        checklist,
        createdById: session._id,
      },
    });
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return NextResponse.json(
        {
          success: false,
          error: "Assignee or related ticket no longer exists. Reload the page and try again.",
        },
        { status: 400 }
      );
    }
    throw err;
  }

  if (task.assigneeId !== session._id) {
    await prisma.notification.create({
      data: {
        recipientId: task.assigneeId,
        title: "New Task Assigned",
        message: `Task: ${task.title}`,
        type: "task_assigned",
        link: `/tasks`,
      },
    });
  }

  await createAuditLog({
    actorId: session._id, actorName: session.displayName,
    action: "Create", module: "Task",
    targetId: task.id, targetLabel: task.title,
  });

  return NextResponse.json({ success: true, data: serialize(task) }, { status: 201 });
}
