import prisma from "@/lib/db";
import type { Prisma, AuditAction, AuditModule } from "@/generated/prisma/client";

export async function createAuditLog(params: {
  actorId: string;
  actorName: string;
  action: AuditAction;
  module: AuditModule;
  targetId: string;
  targetLabel: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      actorName: params.actorName,
      action: params.action,
      module: params.module,
      targetId: params.targetId,
      targetLabel: params.targetLabel,
      before: (params.before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (params.after ?? undefined) as Prisma.InputJsonValue | undefined,
      ipAddress: params.ipAddress,
    },
  });
}
