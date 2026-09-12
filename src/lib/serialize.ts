/**
 * Response shaping for API routes.
 *
 * The database uses `id` as the primary key. The UI (and the JWT session
 * payload) reads `_id`. This adds `_id` alongside `id` on every record and
 * nested relation so both names work.
 *
 * Json columns are copied through untouched. Their contents are arbitrary
 * admin-supplied data that legitimately uses `id` for its own purposes —
 * `settings.value` for `assetTypes` holds `{ id: "at-laptop", … }`, and
 * `audit_logs.before` / `after` hold field snapshots of any shape. Recursing
 * into those would rewrite real data, so every Json-backed field is listed in
 * JSON_FIELDS and skipped.
 */

/** Fields declared as `Json` in prisma/schema.prisma. Never recursed into. */
const JSON_FIELDS = new Set([
  "value", // Settings.value
  "before", // AuditLog.before
  "after", // AuditLog.after
  "summary", // ImportHistory.summary
  "failures", // ImportHistory.failures
  "results", // ImportHistory.results
  "checklist", // Task.checklist
  "widgets", // Dashboard.widgets
  "defaultFields", // TicketTemplate.defaultFields
  "businessHours", // Sla.businessHours
  "escalation", // Sla.escalation
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date);
}

function walk(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(walk);
  if (value instanceof Date) return value.toISOString();
  if (!isPlainObject(value)) return value;

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = JSON_FIELDS.has(key) ? val : walk(val);
  }
  if (typeof out.id === "string" && out._id === undefined) {
    out._id = out.id;
  }
  return out;
}

/** Add `_id` aliases and stringify dates, recursively. */
export function serialize<T>(data: T): T {
  return walk(data) as T;
}
