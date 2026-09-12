import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * @deprecated Use server-side `generateTicketNumberForType` from `@/lib/ticket-number`.
 * Kept for any client/legacy calls — format is not the production ID scheme.
 */
export function generateTicketNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `TKT${y}${m}${rand}`;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True when `v` looks like a database id (UUID). Route handlers use this to
 * answer 404 for a malformed id instead of pushing it into a query.
 */
export function isId(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export function generateAssetTag(): string {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `AST-${rand}`;
}

export function getInitials(name?: string | null): string {
  if (!name || typeof name !== "string") return "?";
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return initials || "?";
}

/** Escape HTML special characters to prevent injection in email templates */
export function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Solid bg + light text so chips stay readable in light mode */
export const PRIORITY_COLORS: Record<string, string> = {
  "Very Low": "bg-slate-500 text-white dark:bg-slate-600 dark:text-white",
  Low: "bg-blue-600 text-white dark:bg-blue-600 dark:text-white",
  Normal: "bg-green-600 text-white dark:bg-green-600 dark:text-white",
  High: "bg-orange-500 text-white dark:bg-orange-500 dark:text-white",
  "Very High": "bg-red-600 text-white dark:bg-red-600 dark:text-white",
};

export const STATUS_COLORS: Record<string, string> = {
  "Pending Approval": "bg-purple-600 text-white dark:bg-purple-600 dark:text-white",
  Open: "bg-blue-600 text-white dark:bg-blue-600 dark:text-white",
  "On Hold": "bg-slate-500 text-white dark:bg-slate-500 dark:text-white",
  "In Progress": "bg-amber-500 text-white dark:bg-amber-500 dark:text-white",
  Closed: "bg-slate-600 text-white dark:bg-slate-600 dark:text-white",
  Reject: "bg-red-600 text-white dark:bg-red-600 dark:text-white",
  // legacy aliases
  Resolved: "bg-slate-600 text-white dark:bg-slate-600 dark:text-white",
  Reopened: "bg-blue-600 text-white dark:bg-blue-600 dark:text-white",
  Rejected: "bg-red-600 text-white dark:bg-red-600 dark:text-white",
};

export const ASSET_STATE_COLORS: Record<string, string> = {
  "In Use": "bg-green-600 text-white dark:bg-green-600 dark:text-white",
  "In Warehouse": "bg-blue-600 text-white dark:bg-blue-600 dark:text-white",
  "In Repair": "bg-amber-500 text-white dark:bg-amber-500 dark:text-white",
  Broken: "bg-red-600 text-white dark:bg-red-600 dark:text-white",
  Disposed: "bg-slate-600 text-white dark:bg-slate-600 dark:text-white",
};

export const DEFAULT_PRIORITY_MATRIX: Record<string, Record<string, string>> = {
  "Very Low": { "Very Low": "Very Low", Low: "Very Low", Normal: "Low", High: "Low", "Very High": "Normal" },
  Low: { "Very Low": "Very Low", Low: "Low", Normal: "Low", High: "Normal", "Very High": "High" },
  Normal: { "Very Low": "Low", Low: "Low", Normal: "Normal", High: "High", "Very High": "High" },
  High: { "Very Low": "Low", Low: "Normal", Normal: "High", High: "High", "Very High": "Very High" },
  "Very High": { "Very Low": "Normal", Low: "High", Normal: "High", High: "Very High", "Very High": "Very High" },
};
