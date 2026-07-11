import type { Role, UserType } from "@/types";
import {
  ALL_NAV,
  DEFAULT_NAV_ACCESS,
  filterNavForUser,
  type AppNavItem,
  type NavAccessMap,
} from "@/lib/nav-config";

export interface SearchableFeature {
  id: string;
  label: string;
  href: string;
  icon: string;
  group?: string;
  section: "general" | "superadmin" | "account";
  /** Extra keywords for search (aliases) */
  keywords?: string[];
  superAdminOnly?: boolean;
  /** If set, only these user types (or SuperAdmin) may see this entry */
  userTypes?: UserType[];
}

/**
 * Extra pages not always listed as leaf nav items — still searchable.
 * Access is filtered by role / user type below.
 */
const EXTRA_FEATURES: SearchableFeature[] = [
  // Account / shell
  {
    id: "pref-app",
    label: "App Preferences",
    href: "/preferences",
    icon: "Settings2",
    group: "Account",
    section: "account",
    keywords: [
      "preferences",
      "settings",
      "theme",
      "layout",
      "sound",
      "notification sound",
      "system color",
      "dark mode",
      "white mode",
      "navbar",
    ],
  },
  {
    id: "pref-profile",
    label: "Profile",
    href: "/profile",
    icon: "UserCog",
    group: "Account",
    section: "account",
    keywords: ["profile", "account", "my profile", "user profile"],
  },
  {
    id: "pref-notifications",
    label: "Notifications",
    href: "/notifications",
    icon: "Mail",
    group: "Account",
    section: "account",
    keywords: ["notification", "notifications", "inbox", "alerts", "bell"],
  },
  // App modules (exist in app, not always in short general nav)
  {
    id: "feat-my-assets",
    label: "My Assets",
    href: "/assets",
    icon: "Package",
    group: "Assets",
    section: "general",
    keywords: ["my assets", "asset", "assets", "inventory", "hardware", "software"],
  },
  {
    id: "feat-new-asset",
    label: "New Asset",
    href: "/assets/new",
    icon: "Package",
    group: "Assets",
    section: "general",
    keywords: ["create asset", "add asset", "new asset"],
    superAdminOnly: true,
  },
  {
    id: "feat-new-ticket",
    label: "New Request / Ticket",
    href: "/tickets/new",
    icon: "Ticket",
    group: "Requests",
    section: "general",
    keywords: ["new ticket", "create ticket", "new request", "submit request", "incident"],
  },
  {
    id: "feat-tasks",
    label: "My Tasks",
    href: "/tasks",
    icon: "FileText",
    group: "Work",
    section: "general",
    keywords: ["task", "tasks", "todo", "my tasks", "kanban"],
  },
  {
    id: "feat-purchases",
    label: "Purchases",
    href: "/purchases",
    icon: "Boxes",
    group: "Work",
    section: "general",
    keywords: ["purchase", "purchases", "procurement", "buy"],
  },
  {
    id: "feat-reports",
    label: "Reports",
    href: "/reports",
    icon: "ScrollText",
    group: "Work",
    section: "general",
    keywords: ["report", "reports", "analytics", "statistics"],
  },
  {
    id: "feat-superadmin-hub",
    label: "SuperAdmin Hub",
    href: "/admin",
    icon: "Shield",
    group: "SuperAdmin",
    section: "superadmin",
    keywords: ["superadmin", "admin hub", "management", "admin home"],
    superAdminOnly: true,
  },
  // Aliases for admin pages with friendlier names
  {
    id: "alias-notification-settings",
    label: "Notification Settings",
    href: "/admin/notification-settings",
    icon: "Mail",
    group: "System Management",
    section: "superadmin",
    keywords: ["notification settings", "smtp", "email settings", "mail settings", "notification"],
    superAdminOnly: true,
  },
];

function canAccessExtra(
  f: SearchableFeature,
  role: Role,
  userTypes: UserType[],
  access: NavAccessMap
): boolean {
  if (f.superAdminOnly) {
    if (role === "SuperAdmin") return true;
    if (f.id === "feat-superadmin-hub") return false;
    // Auditor: only audit-related extras if any
    return false;
  }
  if (f.userTypes?.length) {
    if (role === "SuperAdmin") return true;
    return f.userTypes.some((t) => userTypes.includes(t));
  }
  // Gate general module extras by navbar access where applicable
  if (f.href.startsWith("/assets")) {
    const allowed = access.assets ?? "all";
    if (allowed === "all") return true;
    return allowed.some((t) => userTypes.includes(t));
  }
  if (f.href.startsWith("/tickets")) {
    const allowed = access.requests ?? "all";
    if (allowed === "all") return true;
    return allowed.some((t) => userTypes.includes(t));
  }
  // Account + work modules: any authenticated user
  return true;
}

/** Flatten nav tree for search — only items the user can access */
export function getSearchableFeatures(
  role: Role,
  userTypes: UserType[],
  access: NavAccessMap = DEFAULT_NAV_ACCESS,
  menuOrder?: string[]
): SearchableFeature[] {
  const filtered = filterNavForUser(ALL_NAV, role, userTypes, access, menuOrder);
  const out: SearchableFeature[] = [];

  function walk(items: AppNavItem[], parentLabel?: string) {
    for (const item of items) {
      if (item.children?.length) {
        for (const child of item.children) {
          out.push({
            id: child.id,
            label: child.label,
            href: child.href,
            icon: child.icon,
            group: item.label,
            section: child.section,
            keywords: [child.label, item.label, child.href],
          });
        }
        // Also index parent group as hub when useful
        if (item.href) {
          out.push({
            id: `${item.id}-hub`,
            label: item.label,
            href: item.href,
            icon: item.icon,
            group: "SuperAdmin",
            section: item.section,
            keywords: [item.label, "management"],
          });
        }
      } else {
        out.push({
          id: item.id,
          label: item.label,
          href: item.href,
          icon: item.icon,
          group: parentLabel,
          section: item.section,
          keywords: [item.label, item.href],
        });
      }
    }
  }

  walk(filtered);

  // Friendly aliases on common admin entries
  for (const f of out) {
    if (f.href === "/admin/notification-settings") {
      f.keywords = [
        ...(f.keywords || []),
        "notification settings",
        "notification",
        "smtp",
        "email",
      ];
      if (f.label === "SMTP Settings") {
        // keep both names searchable; add duplicate-friendly label via keywords
      }
    }
    if (f.href === "/assets") {
      f.keywords = [...(f.keywords || []), "my assets", "asset", "inventory"];
      if (f.label === "Assets") {
        // also expose as My Assets in extras
      }
    }
  }

  for (const extra of EXTRA_FEATURES) {
    if (canAccessExtra(extra, role, userTypes, access)) {
      out.push(extra);
    }
  }

  // Deduplicate by href+label (allow My Assets + Assets both pointing /assets with different labels)
  const seen = new Set<string>();
  return out.filter((f) => {
    const key = `${f.href}::${f.label.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function searchFeatures(features: SearchableFeature[], query: string): SearchableFeature[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const tokens = q.split(/\s+/).filter(Boolean);

  const ranked = features
    .map((f) => {
      const label = f.label.toLowerCase();
      const group = (f.group || "").toLowerCase();
      const href = f.href.toLowerCase();
      const kw = (f.keywords || []).map((k) => k.toLowerCase()).join(" ");
      const hay = `${label} ${group} ${href} ${kw}`;

      // Every token must match somewhere (label/group/keywords/href)
      if (!tokens.every((t) => hay.includes(t))) return null;

      let score = 0;
      if (label === q) score += 100;
      else if (label.startsWith(q)) score += 80;
      else if (label.includes(q)) score += 50;
      if (kw.includes(q)) score += 45;
      if (group.includes(q)) score += 20;
      if (href.includes(q.replace(/\s+/g, ""))) score += 15;
      score += 10 * tokens.length;
      return { f, score };
    })
    .filter((x): x is { f: SearchableFeature; score: number } => x != null && x.score > 0)
    .sort((a, b) => b.score - a.score || a.f.label.localeCompare(b.f.label));

  return ranked.map((x) => x.f).slice(0, 16);
}
