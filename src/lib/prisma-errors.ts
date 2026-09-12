import { Prisma } from "@/generated/prisma/client";

/**
 * True when `err` is a unique-constraint violation (P2002).
 *
 * Pass `column` to narrow it to one constraint. Prisma reports the target
 * either as the field names or as the underlying index name depending on the
 * driver, so both spellings are accepted — e.g. `ticketNumber` and
 * `ticket_number` / `tickets_ticket_number_key`.
 */
export function isUniqueViolation(err: unknown, column?: string): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
    return false;
  }
  if (!column) return true;

  const target = err.meta?.target;
  const parts = Array.isArray(target) ? target.map(String) : [String(target ?? "")];
  const needle = column.replace(/_/g, "").toLowerCase();
  return parts.some((p) => p.replace(/_/g, "").toLowerCase().includes(needle));
}

/**
 * True when `err` is a foreign-key violation (P2003) — a write referenced a row
 * that does not exist. Client-supplied ids (assignee, approver, related assets)
 * can hit this from a stale page, so callers turn it into a 400 rather than
 * letting it surface as a 500.
 */
export function isForeignKeyViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    (err.code === "P2003" || err.code === "P2025")
  );
}
