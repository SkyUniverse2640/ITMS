import "server-only";

import mongoose from "mongoose";
import Ticket from "@/lib/models/Ticket";
import User from "@/lib/models/User";
import Asset from "@/lib/models/Asset";

type LeanDoc = Record<string, unknown>;

function asId(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "_id" in v) {
    return String((v as { _id: unknown })._id);
  }
  return String(v);
}

/**
 * Load a ticket for the detail page WITHOUT mongoose .populate().
 * Avoids StrictPopulateError (logs.actor / stale HMR schema cache).
 */
export async function loadTicketDetail(id: string): Promise<LeanDoc | null> {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;

  // Plain lean read — no populate paths at all
  const ticket = (await Ticket.findById(id).lean()) as LeanDoc | null;
  if (!ticket) return null;

  const userIds = new Set<string>();
  const requesterId = asId(ticket.requester);
  const technicianId = asId(ticket.technician);
  const approverId = asId(ticket.approver);
  if (requesterId) userIds.add(requesterId);
  if (technicianId) userIds.add(technicianId);
  if (approverId) userIds.add(approverId);

  const comments = Array.isArray(ticket.comments) ? (ticket.comments as LeanDoc[]) : [];
  for (const c of comments) {
    const a = asId(c.author);
    if (a) userIds.add(a);
  }

  // logs.actor intentionally NOT loaded as User — actorName/actorEmail are denormalized

  const assetIds = Array.isArray(ticket.relatedAssets)
    ? (ticket.relatedAssets as unknown[]).map(asId).filter(Boolean)
    : [];

  const [users, assets] = await Promise.all([
    userIds.size
      ? User.find({ _id: { $in: [...userIds] } })
          .select("_id displayName email department userTypes role")
          .lean()
      : Promise.resolve([]),
    assetIds.length
      ? Asset.find({ _id: { $in: assetIds } })
          .select("_id name assetTag")
          .lean()
      : Promise.resolve([]),
  ]);

  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const assetMap = new Map(assets.map((a) => [String(a._id), a]));

  const pickUser = (raw: unknown) => {
    const id = asId(raw);
    if (!id) return raw ?? null;
    const u = userMap.get(id);
    return u
      ? {
          _id: String(u._id),
          displayName: u.displayName,
          email: u.email,
          department: (u as { department?: string }).department,
          userTypes: (u as { userTypes?: string[] }).userTypes,
          role: (u as { role?: string }).role,
        }
      : { _id: id };
  };

  return {
    ...ticket,
    _id: String(ticket._id),
    requester: pickUser(ticket.requester),
    technician: technicianId ? pickUser(ticket.technician) : null,
    approver: approverId ? pickUser(ticket.approver) : null,
    relatedAssets: assetIds.map((aid) => {
      const a = assetMap.get(aid);
      return a
        ? { _id: String(a._id), name: a.name, assetTag: a.assetTag }
        : { _id: aid };
    }),
    comments: comments.map((c) => ({
      ...c,
      author: pickUser(c.author),
    })),
    // keep logs as stored (actorName / actorEmail / message)
    logs: Array.isArray(ticket.logs) ? ticket.logs : [],
  };
}
