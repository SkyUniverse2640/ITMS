import "server-only";

import { Settings } from "@/lib/models/Settings";

/** Compute SLA due date from priority → slaConfigs duration (minutes) */
export async function computeSlaDueAt(priorityName?: string): Promise<Date | null> {
  try {
    const [priSetting, slaSetting] = await Promise.all([
      Settings.findOne({ key: "priorities" }).lean(),
      Settings.findOne({ key: "slaConfigs" }).lean(),
    ]);
    const priorities = Array.isArray(priSetting?.value) ? (priSetting!.value as Record<string, unknown>[]) : [];
    const slas = Array.isArray(slaSetting?.value) ? (slaSetting!.value as Record<string, unknown>[]) : [];
    const pri = priorities.find(
      (p) => String(p.name || "").toLowerCase() === String(priorityName || "Normal").toLowerCase()
    );
    const slaId = pri ? String(pri.slaId || "") : "";
    let sla = slaId ? slas.find((s) => String(s.id) === slaId) : null;
    if (!sla && slas.length) sla = slas[0];
    const duration = Number(sla?.duration);
    if (!duration || duration <= 0) return null;
    return new Date(Date.now() + duration * 60 * 1000);
  } catch {
    return null;
  }
}

export async function getSlaEscalationRoles(priorityName?: string): Promise<{
  duration: number;
  escalation: { percentage: number; notifyRoles: string[] }[];
}> {
  try {
    const [priSetting, slaSetting] = await Promise.all([
      Settings.findOne({ key: "priorities" }).lean(),
      Settings.findOne({ key: "slaConfigs" }).lean(),
    ]);
    const priorities = Array.isArray(priSetting?.value) ? (priSetting!.value as Record<string, unknown>[]) : [];
    const slas = Array.isArray(slaSetting?.value) ? (slaSetting!.value as Record<string, unknown>[]) : [];
    const pri = priorities.find(
      (p) => String(p.name || "").toLowerCase() === String(priorityName || "Normal").toLowerCase()
    );
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
