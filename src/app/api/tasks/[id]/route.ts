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

/** Only SuperAdmin, the assignee, or the creator may see/act on a task. */
function canAccessTask(
  task: { assigneeId: string; createdById: string },
  session: { _id: string; role: string }
): boolean {
  if (session.role === "SuperAdmin") return true;
  return task.assigneeId === session._id || task.createdById === session._id;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isId(id)) {
    return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
  }
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignee: { select: { id: true, displayName: true } },
      relatedTicket: { select: { id: true, ticketNumber: true, subject: true } },
    },
  });
  if (!task) return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });

  if (!canAccessTask(task, session)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ success: true, data: serialize(task) });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isId(id)) {
    return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
  }
  const body = await req.json();
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });

  if (!canAccessTask(task, session)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const data: Prisma.TaskUncheckedUpdateInput = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if ("description" in body) data.description = body.description || null;
  if (typeof body.status === "string" && body.status) data.status = body.status;
  if (typeof body.priority === "string" && body.priority) data.priority = body.priority;
  if ("assignee" in body) {
    if (!isId(String(body.assignee))) {
      return NextResponse.json({ success: false, error: "Invalid assignee" }, { status: 400 });
    }
    data.assigneeId = String(body.assignee);
  }
  if ("relatedTicket" in body) {
    data.relatedTicketId = isId(String(body.relatedTicket)) ? String(body.relatedTicket) : null;
  }
  for (const key of ["dateStart", "dateEnd", "dueDate"] as const) {
    if (key in body) data[key] = body[key] ? new Date(body[key]) : null;
  }
  if (Array.isArray(body.checklist)) {
    data.checklist = body.checklist
      .filter((c: unknown) => c && typeof c === "object")
      .map((c: { item?: unknown; done?: unknown }) => ({
        item: String(c.item ?? ""),
        done: Boolean(c.done),
      }))
      .filter((c: { item: string }) => c.item);
  }

  const start = (data.dateStart as Date | null | undefined) ?? task.dateStart;
  const end = (data.dateEnd as Date | null | undefined) ?? task.dateEnd;
  if (start && end && start >= end) {
    return NextResponse.json({ success: false, error: "Date Start must be before Date End" }, { status: 400 });
  }

  const before = { status: task.status, priority: task.priority };
  let updated;
  try {
    updated = await prisma.task.update({ where: { id }, data });
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

  await createAuditLog({
    actorId: session._id, actorName: session.displayName,
    action: "Update", module: "Task",
    targetId: updated.id, targetLabel: updated.title,
    before, after: { status: updated.status, priority: updated.priority },
  });

  return NextResponse.json({ success: true, data: serialize(updated) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isId(id)) {
    return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
  }
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });

  if (!canAccessTask(task, session)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  await prisma.task.delete({ where: { id } });

  await createAuditLog({
    actorId: session._id, actorName: session.displayName,
    action: "Delete", module: "Task",
    targetId: task.id, targetLabel: task.title,
  });

  return NextResponse.json({ success: true, message: "Task deleted" });
}
