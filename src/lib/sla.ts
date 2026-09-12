import "server-only";

import prisma from "@/lib/db";

interface PriorityRecord {
  name: string;
  respondTime?: number;
  resolveTime?: number;
  slaId?: string;
  [key: string]: unknown;
}

type PriorityMatrix = Record<string, Record<string, string>>;

/**
 * Derive priority name from Impact × Urgency using the stored matrix.
 * Falls back to urgency if matrix not configured.
 */
export async function derivePriorityFromMatrix(
  impact: string,
  urgency: string
): Promise<string> {
  try {
    const matrixSetting = await prisma.settings.findUnique({
      where: { key: "priorityMatrix" },
    });
    const matrix = matrixSetting?.value as PriorityMatrix | undefined;
    if (matrix && typeof matrix === "object") {
      const row = matrix[impact];
      if (row && typeof row === "object" && row[urgency]) {
        return row[urgency];
      }
    }
  } catch {}
  return urgency || "Normal";
}

/**
 * Compute SLA respond + resolve due dates from a priority name.
 * Each priority stores its own respondTime / resolveTime (minutes).
 */
export async function computeSlaDueDates(priorityName?: string): Promise<{
  respondDueAt: Date | null;
  resolveDueAt: Date | null;
}> {
  try {
    const priSetting = await prisma.settings.findUnique({ where: { key: "priorities" } });
    const priorities = Array.isArray(priSetting?.value)
      ? (priSetting.value as unknown as PriorityRecord[])
      : [];

    const pri = priorities.find(
      (p) => String(p.name || "").toLowerCase() === String(priorityName || "Normal").toLowerCase()
    );

    const respondMinutes = Number(pri?.respondTime) || 0;
    const resolveMinutes = Number(pri?.resolveTime) || 0;
    const now = Date.now();

    return {
      respondDueAt: respondMinutes > 0 ? new Date(now + respondMinutes * 60_000) : null,
      resolveDueAt: resolveMinutes > 0 ? new Date(now + resolveMinutes * 60_000) : null,
    };
  } catch {
    return { respondDueAt: null, resolveDueAt: null };
  }
}

/** @deprecated Use computeSlaDueDates — kept for backward compat */
export async function computeSlaDueAt(priorityName?: string): Promise<Date | null> {
  const { resolveDueAt } = await computeSlaDueDates(priorityName);
  return resolveDueAt;
}

/**
 * SLA is binary: OK or Breach. This computes the two breach flags from a
 * ticket's stored due dates + response/resolution timestamps.
 *
 * Pragmatic wall-clock model:
 * - Respond SLA breaches if there is no first response by slaRespondDueAt.
 *   Once responded (slaRespondedAt set), it is locked to whether that response
 *   beat the deadline — no longer moves.
 * - Resolve SLA breaches if the ticket is not resolved/closed by slaDueAt.
 *   Once resolved/closed, it is locked to whether closure beat the deadline.
 * - Terminal statuses (Closed/Reject) freeze both flags at closure time.
 *
 * Approval-wait time is excluded upstream by recomputing due dates when a
 * ticket leaves Pending Approval (see the ticket PUT handler); this function
 * simply compares against whatever due dates are currently stored.
 */
export function computeSlaFlags(input: {
  slaRespondDueAt?: Date | string | null;
  slaDueAt?: Date | string | null;
  slaRespondedAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  closedAt?: Date | string | null;
  now?: Date;
}): { slaRespondBreached: boolean; slaBreached: boolean } {
  const now = input.now ?? new Date();
  const toTime = (v: Date | string | null | undefined): number | null => {
    if (!v) return null;
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : null;
  };

  const respondDue = toTime(input.slaRespondDueAt);
  const resolveDue = toTime(input.slaDueAt);
  const respondedAt = toTime(input.slaRespondedAt);
  // A ticket is "done" once closed (Reject also stamps closedAt) or resolved.
  const doneAt = toTime(input.closedAt) ?? toTime(input.resolvedAt);
  const nowT = now.getTime();

  // Respond SLA: locked once a first response exists.
  let slaRespondBreached = false;
  if (respondDue != null) {
    if (respondedAt != null) {
      slaRespondBreached = respondedAt > respondDue;
    } else {
      // No response yet. If closed without responding, freeze at closure time.
      const ref = doneAt ?? nowT;
      slaRespondBreached = ref > respondDue;
    }
  }

  // Resolve SLA: locked once resolved/closed.
  let slaBreached = false;
  if (resolveDue != null) {
    const ref = doneAt ?? nowT;
    slaBreached = ref > resolveDue;
  }

  return { slaRespondBreached, slaBreached };
}

export async function getSlaEscalationRoles(priorityName?: string): Promise<{
  duration: number;
  escalation: { percentage: number; notifyRoles: string[] }[];
}> {
  try {
    const [priSetting, slaSetting] = await Promise.all([
      prisma.settings.findUnique({ where: { key: "priorities" } }),
      prisma.settings.findUnique({ where: { key: "slaConfigs" } }),
    ]);
    const priorities = Array.isArray(priSetting?.value)
      ? (priSetting.value as unknown as PriorityRecord[])
      : [];
    const slas = Array.isArray(slaSetting?.value)
      ? (slaSetting.value as unknown as Record<string, unknown>[])
      : [];
    const pri = priorities.find(
      (p) => String(p.name || "").toLowerCase() === String(priorityName || "Normal").toLowerCase()
    );

    const resolveMinutes = Number(pri?.resolveTime) || 0;
    if (resolveMinutes > 0) {
      return {
        duration: resolveMinutes,
        escalation: [
          { percentage: 75, notifyRoles: ["Technician"] },
          { percentage: 100, notifyRoles: ["Technician", "SuperAdmin"] },
        ],
      };
    }

    const slaId = pri ? String(pri.slaId || "") : "";
    let sla = slaId ? slas.find((s) => String(s.id) === slaId) : null;
    if (!sla && slas.length) sla = slas[0];
    return {
      duration: Number(sla?.duration) || 0,
      escalation: Array.isArray(sla?.escalation)
        ? (sla!.escalation as { percentage: number; notifyRoles: string[] }[])
        : [],
    };
  } catch {
    return { duration: 0, escalation: [] };
  }
}
