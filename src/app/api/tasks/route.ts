export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Task from "@/lib/models/Task";
import Notification from "@/lib/models/Notification";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50"));
  const status = url.searchParams.get("status") || "";
  const ticketId = url.searchParams.get("ticketId") || "";
  const view = url.searchParams.get("view") || "";

  const filter: Record<string, unknown> = {};
  if (view === "my" || session.role !== "SuperAdmin") filter.assignee = session._id;
  if (status) filter.status = status;
  if (ticketId) filter.relatedTicket = ticketId;

  const [tasks, total] = await Promise.all([
    Task.find(filter).populate("assignee", "displayName").populate("relatedTicket", "ticketNumber subject").sort("status dueDate").skip((page - 1) * limit).limit(limit).lean(),
    Task.countDocuments(filter),
  ]);

  return NextResponse.json({ success: true, data: tasks, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const body = await req.json();
  const task = await Task.create({
    title: body.title,
    description: body.description,
    status: body.status,
    priority: body.priority,
    assignee: body.assignee,
    dueDate: body.dueDate,
    relatedTicket: body.relatedTicket,
    createdBy: session._id,
  });

  if (task.assignee.toString() !== session._id) {
    await Notification.create({
      recipient: task.assignee,
      title: "New Task Assigned",
      message: `Task: ${task.title}`,
      type: "task_assigned",
      link: `/tasks`,
    });
  }

  await createAuditLog({
    actorId: session._id, actorName: session.displayName,
    action: "Create", module: "Task",
    targetId: task._id.toString(), targetLabel: task.title,
  });

  return NextResponse.json({ success: true, data: task }, { status: 201 });
}
