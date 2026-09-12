import "server-only";

import prisma from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { isId } from "@/lib/utils";

type LeanDoc = Record<string, unknown>;

/** Fields exposed for a referenced user (requester / technician / approver / author). */
const USER_REF = {
  id: true,
  displayName: true,
  email: true,
  department: true,
  userTypes: true,
  role: true,
} as const;

/**
 * Load a ticket for the detail page with its relations resolved.
 *
 * `comments` and `logs` are returned as arrays on the ticket and
 * `relatedAssets` as a flat list of assets (not join rows), which is the shape
 * the detail page renders. `logs[].actor` is deliberately not expanded —
 * actorName / actorEmail are denormalized on the log row.
 */
export async function loadTicketDetail(id: string): Promise<LeanDoc | null> {
  if (!isId(id)) return null;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      requester: { select: USER_REF },
      technician: { select: USER_REF },
      approver: { select: USER_REF },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: USER_REF } },
      },
      logs: { orderBy: { createdAt: "asc" } },
      relatedAssets: {
        include: { asset: { select: { id: true, name: true, assetTag: true } } },
      },
    },
  });
  if (!ticket) return null;

  const { relatedAssets, ...rest } = ticket;

  return serialize({
    ...rest,
    relatedAssets: relatedAssets.map((r) => r.asset),
  }) as LeanDoc;
}
