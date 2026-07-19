import type { Role, UserType } from "@/types";

export type NavLayout = "sidebar" | "top" | "bottom";

export interface AppNavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  /** SuperAdmin only */
  superAdminOnly?: boolean;
  /** Show for these user types (any match). Empty = all authenticated users */
  userTypes?: UserType[];
  /** Nested items (for SuperAdmin sections) */
  children?: AppNavItem[];
  /** Default order */
  order: number;
  /** General feature vs SuperAdmin feature */
  section: "general" | "superadmin";
}

/** General Feature navbar (dynamic; SuperAdmin can toggle per user type) */
export const GENERAL_NAV: AppNavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/", icon: "LayoutDashboard", order: 0, section: "general" },
  { id: "requests", label: "Requests", href: "/tickets", icon: "Ticket", order: 1, section: "general" },
  { id: "assets", label: "Assets", href: "/assets", icon: "Package", order: 2, section: "general" },
];

/** SuperAdmin Feature — kategori sesuai spek */
export const SUPERADMIN_NAV: AppNavItem[] = [
  {
    id: "sa-requests",
    label: "Requests Management",
    href: "/admin/ticket-settings",
    icon: "Tags",
    superAdminOnly: true,
    order: 10,
    section: "superadmin",
    children: [
      { id: "sa-ticket-settings", label: "Ticket Settings", href: "/admin/ticket-settings", icon: "Settings2", order: 0, section: "superadmin", superAdminOnly: true },
      { id: "sa-ticket-templates", label: "Ticket Template", href: "/admin/ticket-templates", icon: "FileStack", order: 1, section: "superadmin", superAdminOnly: true },
    ],
  },
  {
    id: "sa-system",
    label: "System Management",
    href: "/admin/notification-settings",
    icon: "Monitor",
    superAdminOnly: true,
    order: 11,
    section: "superadmin",
    children: [
      { id: "sa-smtp", label: "SMTP Settings", href: "/admin/notification-settings", icon: "Mail", order: 0, section: "superadmin", superAdminOnly: true },
      { id: "sa-appearance", label: "Appearance Settings", href: "/admin/appearance", icon: "Palette", order: 1, section: "superadmin", superAdminOnly: true },
      { id: "sa-sites", label: "Site Settings", href: "/admin/site-settings", icon: "MapPin", order: 2, section: "superadmin", superAdminOnly: true },
    ],
  },
  {
    id: "sa-users",
    label: "Users Management",
    href: "/admin/users",
    icon: "Users",
    superAdminOnly: true,
    order: 12,
    section: "superadmin",
    children: [
      { id: "sa-users-crud", label: "Manage Users", href: "/admin/users", icon: "UserCog", order: 0, section: "superadmin", superAdminOnly: true },
      { id: "sa-departments", label: "Manage Department", href: "/admin/departments", icon: "Building2", order: 1, section: "superadmin", superAdminOnly: true },
      { id: "sa-user-types", label: "Manage Roles / User Types", href: "/admin/user-types", icon: "Shield", order: 2, section: "superadmin", superAdminOnly: true },
      { id: "sa-nav-access", label: "Navbar Access", href: "/admin/nav-access", icon: "Menu", order: 3, section: "superadmin", superAdminOnly: true },
    ],
  },
  {
    id: "sa-assets",
    label: "Assets Management",
    href: "/admin/assets-manage",
    icon: "Boxes",
    superAdminOnly: true,
    order: 13,
    section: "superadmin",
    children: [
      { id: "sa-assets-all", label: "Manage All Assets", href: "/admin/assets-manage", icon: "Package", order: 0, section: "superadmin", superAdminOnly: true },
      { id: "sa-assets-settings", label: "Assets Settings", href: "/admin/asset-settings", icon: "Boxes", order: 1, section: "superadmin", superAdminOnly: true },
      { id: "sa-ack", label: "Acknowledgment Form", href: "/admin/acknowledgment", icon: "FileText", order: 2, section: "superadmin", superAdminOnly: true },
    ],
  },
  {
    id: "sa-audit",
    label: "Audit Trail",
    href: "/admin/audit-trail",
    icon: "ScrollText",
    superAdminOnly: true,
    order: 14,
    section: "superadmin",
  },
];

export const ALL_NAV: AppNavItem[] = [...GENERAL_NAV, ...SUPERADMIN_NAV];

/** Default menu access: which user types can see each general nav item */
export type NavAccessMap = Record<string, UserType[] | "all">;

export const DEFAULT_NAV_ACCESS: NavAccessMap = {
  dashboard: "all",
  requests: "all",
  assets: "all",
};

export function filterNavForUser(
  items: AppNavItem[],
  role: Role,
  userTypes: UserType[],
  access: NavAccessMap = DEFAULT_NAV_ACCESS,
  orderOverride?: string[]
): AppNavItem[] {
  let filtered = items.filter((item) => {
    if (item.superAdminOnly) {
      if (role === "SuperAdmin") return true;
      // Auditor can see audit trail
      if (item.id === "sa-audit" && userTypes.includes("Auditor")) return true;
      return false;
    }
    const allowed = access[item.id] ?? "all";
    if (allowed === "all") return true;
    return allowed.some((t) => userTypes.includes(t));
  });

  if (orderOverride?.length) {
    filtered = [...filtered].sort((a, b) => {
      const ai = orderOverride.indexOf(a.id);
      const bi = orderOverride.indexOf(b.id);
      const ao = ai === -1 ? a.order + 1000 : ai;
      const bo = bi === -1 ? b.order + 1000 : bi;
      return ao - bo;
    });
  } else {
    filtered = [...filtered].sort((a, b) => a.order - b.order);
  }

  return filtered.map((item) => ({
    ...item,
    children: item.children
      ? filterNavForUser(item.children, role, userTypes, access)
      : undefined,
  }));
}

export function getAdminSection(pathname: string): AppNavItem | null {
  for (const item of SUPERADMIN_NAV) {
    if (item.children?.some((c) => pathname === c.href || pathname.startsWith(c.href + "/"))) {
      return item;
    }
    if (pathname === item.href || pathname.startsWith(item.href + "/")) {
      return item;
    }
  }
  return null;
}
