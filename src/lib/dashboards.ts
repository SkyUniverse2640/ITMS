/** Built-in dashboard catalog (client + server safe). */

export type DashboardKey = "general" | "admin" | string;

export interface DashboardMeta {
  key: DashboardKey;
  name: string;
  description: string;
  /** all | superadmin */
  audience: "all" | "superadmin";
  scope: "system" | "user";
  /** General is the system favorite / default for all roles */
  isSystemFavorite?: boolean;
}

export const SYSTEM_DASHBOARDS: DashboardMeta[] = [
  {
    key: "general",
    name: "General Dashboard",
    description: "Default for Requesters and all user types. System favorite.",
    audience: "all",
    scope: "system",
    isSystemFavorite: true,
  },
  {
    key: "admin",
    name: "Admin Dashboard",
    description: "SuperAdmin system overview.",
    audience: "superadmin",
    scope: "system",
  },
];

export function dashboardsVisibleTo(role: string): DashboardMeta[] {
  return SYSTEM_DASHBOARDS.filter(
    (d) => d.audience === "all" || (d.audience === "superadmin" && role === "SuperAdmin")
  );
}

export function resolveDefaultDashboardKey(
  role: string,
  stored?: string | null
): DashboardKey {
  const visible = dashboardsVisibleTo(role).map((d) => d.key);
  if (stored && visible.includes(stored)) return stored;
  // SuperAdmin without preference still defaults to General (favorite)
  return "general";
}
