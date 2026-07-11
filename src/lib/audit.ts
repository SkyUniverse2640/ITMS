import connectDB from "@/lib/db";
import AuditLog from "@/lib/models/AuditLog";

export async function createAuditLog(params: {
  actorId: string;
  actorName: string;
  action: "Create" | "Update" | "Delete";
  module: "Ticket" | "Asset" | "User" | "Task" | "Purchase" | "Settings";
  targetId: string;
  targetLabel: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
}) {
  await connectDB();
  await AuditLog.create({
    actor: params.actorId,
    actorName: params.actorName,
    action: params.action,
    module: params.module,
    targetId: params.targetId,
    targetLabel: params.targetLabel,
    before: params.before,
    after: params.after,
    ipAddress: params.ipAddress,
  });
}
