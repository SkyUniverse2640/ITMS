export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Task from "@/lib/models/Task";
import { getSession } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const { id } = await params;
  const task = await Task.findById(id).populate("assignee", "displayName").populate("relatedTicket", "ticketNumber subject").lean();
  if (!task) return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });

  return NextResponse.json({ success: true, data: task });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const { id } = await params;
  const body = await req.json();
  const task = await Task.findById(id);
  if (!task) return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });

  const before = { status: task.status, priority: task.priority };
  Object.assign(task, body);
  await task.save();

  await createAuditLog({
    actorId: session._id, actorName: session.displayName,
    action: "Update", module: "Task",
    targetId: task._id.toString(), targetLabel: task.title,
    before, after: { status: task.status, priority: task.priority },
  });

  return NextResponse.json({ success: true, data: task });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const { id } = await params;
  const task = await Task.findByIdAndDelete(id);
  if (!task) return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });

  await createAuditLog({
    actorId: session._id, actorName: session.displayName,
    action: "Delete", module: "Task",
    targetId: task._id.toString(), targetLabel: task.title,
  });

  return NextResponse.json({ success: true, message: "Task deleted" });
}
