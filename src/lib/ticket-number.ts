import "server-only";

import Ticket from "@/lib/models/Ticket";
import { Settings } from "@/lib/models/Settings";

/**
 * Ticket ID format: {ticketCode}{YY}{MM}{seq}
 * Example: INC2607001 (Incident code INC, July 2026, sequence 001 for this month)
 *
 * Sequence is per ticketCode + year-month (not global across all types).
 */

export function formatYymm(date = new Date()): { yy: string; mm: string; yymm: string } {
  const yy = date.getFullYear().toString().slice(-2);
  const mm = (date.getMonth() + 1).toString().padStart(2, "0");
  return { yy, mm, yymm: `${yy}${mm}` };
}

/** Normalize admin-entered code: uppercase alphanumeric, 2–8 chars */
export function normalizeTicketCode(raw: string): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

export async function resolveTicketCodeForRequestType(requestTypeName: string): Promise<string> {
  const name = String(requestTypeName || "").trim();
  try {
    const setting = await Settings.findOne({ key: "requestTypes" }).lean();
    const list = Array.isArray(setting?.value) ? (setting!.value as Record<string, unknown>[]) : [];
    const match = list.find(
      (x) => String(x.name || "").toLowerCase() === name.toLowerCase()
    );
    if (match) {
      const code = normalizeTicketCode(String(match.ticketCode || match.code || ""));
      if (code.length >= 2) return code;
    }
  } catch {
    /* fall through */
  }
  // Fallback from type name letters
  const fallback = normalizeTicketCode(name.replace(/\s+/g, "").slice(0, 3));
  return fallback.length >= 2 ? fallback : "TKT";
}

/**
 * Next ticket number for the given request type in the current calendar month.
 */
export async function generateTicketNumberForType(requestTypeName: string): Promise<string> {
  const code = await resolveTicketCodeForRequestType(requestTypeName);
  const { yymm } = formatYymm();
  const prefix = `${code}${yymm}`;

  // Find highest sequence for this prefix this month
  const existing = await Ticket.find({
    ticketNumber: { $regex: `^${escapeRegex(prefix)}\\d+$` },
  })
    .select("ticketNumber")
    .sort({ ticketNumber: -1 })
    .limit(1)
    .lean();

  let nextSeq = 1;
  if (existing[0]?.ticketNumber) {
    const tn = String(existing[0].ticketNumber);
    const seqPart = tn.slice(prefix.length);
    const n = parseInt(seqPart, 10);
    if (!Number.isNaN(n)) nextSeq = n + 1;
  }

  // Cap display at 3 digits unless overflow (then grow: 1000, 1001…)
  const seqStr =
    nextSeq <= 999 ? nextSeq.toString().padStart(3, "0") : String(nextSeq);

  return `${prefix}${seqStr}`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
