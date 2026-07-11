import "server-only";

import connectDB from "@/lib/db";
import Notification from "@/lib/models/Notification";
import { Settings } from "@/lib/models/Settings";
import User from "@/lib/models/User";
import { normalizeDepartments, type DeptRoleLabel } from "@/lib/department-roles";

export type NotifyType =
  | "ticket_created"
  | "ticket_assigned"
  | "status_changed"
  | "comment_added"
  | "sla_warning"
  | "sla_breach"
  | "approval_requested"
  | "approval_decision"
  | "asset_assigned"
  | "purchase_update"
  | string;

/** Map notification type → settings.notificationSettings key */
const TYPE_TO_SETTING: Record<string, string> = {
  ticket_created: "ticketCreated",
  ticket_assigned: "ticketAssigned",
  status_changed: "statusChanged",
  comment_added: "commentAdded",
  sla_warning: "slaWarning",
  sla_breach: "slaBreach",
  approval_requested: "approvalRequested",
  approval_decision: "approvalDecision",
  asset_assigned: "assetAssigned",
  purchase_update: "purchaseUpdate",
};

async function isTypeEnabled(type: NotifyType): Promise<boolean> {
  try {
    await connectDB();
    const setting = await Settings.findOne({ key: "notificationSettings" }).lean();
    const map = (setting?.value || {}) as Record<string, { enabled?: boolean }>;
    const key = TYPE_TO_SETTING[type] || type;
    const cfg = map[key];
    if (cfg && typeof cfg.enabled === "boolean") return cfg.enabled;
    return true; // default on if not configured
  } catch {
    return true;
  }
}

export async function notifyUser(params: {
  recipientId: string | undefined | null;
  title: string;
  message: string;
  type: NotifyType;
  link?: string;
}): Promise<boolean> {
  const { title, message, type, link } = params;
  const recipientId = params.recipientId ? String(params.recipientId).trim() : "";
  if (!recipientId) return false;
  try {
    // Approval notifications should always attempt delivery even if settings missing
    const forceTypes = new Set(["approval_requested", "approval_decision"]);
    if (!forceTypes.has(type) && !(await isTypeEnabled(type))) return false;
    await connectDB();
    // Avoid CastError on invalid ids
    const mongoose = (await import("mongoose")).default;
    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      console.error("notifyUser invalid recipientId:", recipientId, type);
      return false;
    }
    await Notification.create({
      recipient: recipientId,
      title,
      message,
      type,
      link: link || undefined,
      read: false,
    });
    return true;
  } catch (err) {
    console.error("notifyUser failed:", type, recipientId, err);
    return false;
  }
}

export async function notifyUsers(
  recipientIds: string[],
  payload: Omit<Parameters<typeof notifyUser>[0], "recipientId">
): Promise<number> {
  const unique = [...new Set(recipientIds.filter(Boolean))];
  let n = 0;
  for (const id of unique) {
    if (await notifyUser({ ...payload, recipientId: id })) n++;
  }
  return n;
}

/** Notify SuperAdmins */
export async function notifySuperAdmins(
  payload: Omit<Parameters<typeof notifyUser>[0], "recipientId">
): Promise<number> {
  await connectDB();
  const admins = await User.find({ role: "SuperAdmin", status: "Active" })
    .select("_id")
    .lean();
  return notifyUsers(
    admins.map((u) => String(u._id)),
    payload
  );
}

/** Notify department role label members (Director / Manager / Supervisor) */
export async function notifyDepartmentLabel(params: {
  departmentName: string;
  label: DeptRoleLabel;
  title: string;
  message: string;
  type: NotifyType;
  link?: string;
}): Promise<number> {
  await connectDB();
  const setting = await Settings.findOne({ key: "departments" }).lean();
  const depts = normalizeDepartments(setting?.value);
  const ids = depts
    .find((d) => d.name.toLowerCase() === params.departmentName.trim().toLowerCase())
    ?.roles?.[params.label] || [];
  return notifyUsers(ids, {
    title: params.title,
    message: params.message,
    type: params.type,
    link: params.link,
  });
}

/** Resolve user ids for SLA notifyRoles (supports dept labels + SuperAdmin + Technician) */
export async function resolveSlaNotifyRecipients(params: {
  departmentName: string;
  notifyRoles: string[];
  technicianId?: string | null;
}): Promise<string[]> {
  const { departmentName, notifyRoles, technicianId } = params;
  const ids = new Set<string>();

  await connectDB();
  const setting = await Settings.findOne({ key: "departments" }).lean();
  const depts = normalizeDepartments(setting?.value);
  const dept = depts.find(
    (d) => d.name.toLowerCase() === departmentName.trim().toLowerCase()
  );

  for (const role of notifyRoles) {
    if (role === "Director" || role === "Manager" || role === "Supervisor") {
      for (const uid of dept?.roles?.[role] || []) ids.add(uid);
    } else if (role === "SuperAdmin") {
      const admins = await User.find({ role: "SuperAdmin", status: "Active" })
        .select("_id")
        .lean();
      for (const a of admins) ids.add(String(a._id));
    } else if (role === "Technician" && technicianId) {
      ids.add(String(technicianId));
    }
  }
  return [...ids];
}
