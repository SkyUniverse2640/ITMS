/**
 * Canonical ticket statuses + hierarchy rules.
 * Forward-only ranks: technician cannot move status downward.
 * Terminal statuses (Closed, Reject) cannot leave.
 * Pending Approval only exits via approve → Open or reject → Reject.
 */

export interface SystemTicketStatus {
  id: string;
  name: string;
  description: string;
  timerStop: boolean;
  color: string;
  /** Lower = earlier in lifecycle. Same rank only for terminal pair Closed/Reject. */
  rank: number;
  terminal?: boolean;
}

export const SYSTEM_TICKET_STATUSES: SystemTicketStatus[] = [
  {
    id: "st-pending",
    name: "Pending Approval",
    description: "Awaiting approval (timer stopped)",
    timerStop: true,
    color: "#8B5CF6",
    rank: 0,
  },
  {
    id: "st-open",
    name: "Open",
    description: "Ready to work",
    timerStop: false,
    color: "#3B82F6",
    rank: 1,
  },
  {
    id: "st-on-hold",
    name: "On Hold",
    description: "Paused (timer stopped)",
    timerStop: true,
    color: "#6B7280",
    rank: 2,
  },
  {
    id: "st-in-progress",
    name: "In Progress",
    description: "Being worked on",
    timerStop: false,
    color: "#F59E0B",
    rank: 3,
  },
  {
    id: "st-closed",
    name: "Closed",
    description: "Completed (timer stopped)",
    timerStop: true,
    color: "#64748B",
    rank: 4,
    terminal: true,
  },
  {
    id: "st-reject",
    name: "Reject",
    description: "Rejected (timer stopped)",
    timerStop: true,
    color: "#EF4444",
    rank: 4,
    terminal: true,
  },
];

export const TICKET_STATUS_NAMES = SYSTEM_TICKET_STATUSES.map((s) => s.name);

const byName = new Map(SYSTEM_TICKET_STATUSES.map((s) => [s.name.toLowerCase(), s]));

/** Normalize legacy status names to current system names */
export function normalizeStatusName(name: string | undefined | null): string {
  const raw = (name || "").trim();
  if (!raw) return "Open";
  const lower = raw.toLowerCase();
  if (lower === "rejected") return "Reject";
  if (lower === "resolved") return "Closed";
  if (lower === "reopened") return "Open";
  const hit = byName.get(lower);
  if (hit) return hit.name;
  // fuzzy: pending approval variants
  if (lower.includes("pending") && lower.includes("approval")) return "Pending Approval";
  return raw;
}

export function getSystemStatus(name: string | undefined | null): SystemTicketStatus | undefined {
  return byName.get(normalizeStatusName(name).toLowerCase());
}

export function getStatusRank(name: string | undefined | null): number {
  return getSystemStatus(name)?.rank ?? 1;
}

export function isTerminalStatus(name: string | undefined | null): boolean {
  return !!getSystemStatus(name)?.terminal;
}

export function isTimerStopStatus(name: string | undefined | null): boolean {
  return !!getSystemStatus(name)?.timerStop;
}

export function isPendingApproval(name: string | undefined | null): boolean {
  return normalizeStatusName(name) === "Pending Approval";
}

/**
 * Allowed technician transitions (forward hierarchy only).
 * - Same status always ok
 * - Terminal cannot leave
 * - Pending Approval cannot be left manually (use approvalAction)
 * - Cannot set Pending Approval manually
 * - to.rank must be >= from.rank (no go-back)
 */
export function canTransitionStatus(
  fromRaw: string,
  toRaw: string,
  opts?: { approvalAction?: "approve" | "reject" }
): { ok: boolean; error?: string } {
  const from = normalizeStatusName(fromRaw);
  const to = normalizeStatusName(toRaw);

  if (opts?.approvalAction === "approve") {
    if (from !== "Pending Approval") {
      return { ok: false, error: "Only Pending Approval tickets can be approved" };
    }
    if (to !== "Open") {
      return { ok: false, error: "Approve must set status to Open" };
    }
    return { ok: true };
  }
  if (opts?.approvalAction === "reject") {
    if (from !== "Pending Approval") {
      return { ok: false, error: "Only Pending Approval tickets can be rejected" };
    }
    if (to !== "Reject") {
      return { ok: false, error: "Reject action must set status to Reject" };
    }
    return { ok: true };
  }

  if (from === to) return { ok: true };

  if (from === "Pending Approval") {
    return {
      ok: false,
      error: "Status is Pending Approval — wait for approver (Approve → Open / Reject)",
    };
  }

  if (to === "Pending Approval") {
    return {
      ok: false,
      error: "Pending Approval can only be set by the system when a template requires approval",
    };
  }

  const fromMeta = getSystemStatus(from);
  const toMeta = getSystemStatus(to);
  if (!toMeta) {
    return { ok: false, error: `Unknown status: ${toRaw}` };
  }
  if (!fromMeta) {
    // Unknown legacy → allow only forward to known
    return { ok: true };
  }

  if (fromMeta.terminal) {
    return {
      ok: false,
      error: `${from} is final — cannot change status (top of hierarchy)`,
    };
  }

  if (toMeta.rank < fromMeta.rank) {
    return {
      ok: false,
      error: `Cannot move from ${from} back to ${to} (status hierarchy)`,
    };
  }

  return { ok: true };
}

/** Statuses a tech may pick from current status (includes current). */
export function allowedNextStatuses(currentRaw: string): string[] {
  const current = normalizeStatusName(currentRaw);
  if (current === "Pending Approval") {
    return ["Pending Approval"];
  }
  if (isTerminalStatus(current)) {
    return [current];
  }
  const rank = getStatusRank(current);
  return SYSTEM_TICKET_STATUSES.filter(
    (s) => s.name === current || (s.rank >= rank && s.name !== "Pending Approval")
  ).map((s) => s.name);
}

/** Seed / settings payload (without rank — UI stores timerStop + color) */
export function systemStatusesForSettings() {
  return SYSTEM_TICKET_STATUSES.map(({ id, name, description, timerStop, color }) => ({
    id,
    name,
    description,
    timerStop,
    color,
  }));
}

/** Detect if stored statuses need migration to the 6-status system */
export function needsStatusMigration(raw: unknown): boolean {
  if (!Array.isArray(raw) || raw.length === 0) return true;
  const names = new Set(
    raw
      .map((x) =>
        typeof x === "string"
          ? x
          : x && typeof x === "object" && "name" in x
            ? String((x as { name: string }).name)
            : ""
      )
      .filter(Boolean)
      .map((n) => n.toLowerCase())
  );
  const required = ["pending approval", "open", "on hold", "in progress", "closed", "reject"];
  const hasLegacy =
    names.has("resolved") || names.has("reopened") || names.has("rejected");
  const missing = required.some((r) => !names.has(r));
  return hasLegacy || missing || names.size !== required.length;
}
