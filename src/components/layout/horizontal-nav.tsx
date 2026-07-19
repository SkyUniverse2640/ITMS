"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import {
  GENERAL_NAV,
  SUPERADMIN_NAV,
  DEFAULT_NAV_ACCESS,
  filterNavForUser,
  type NavAccessMap,
} from "@/lib/nav-config";
import { NavIcon } from "./nav-icons";
import type { UserType } from "@/types";

/**
 * Top bar / Bottom bar nav:
 * Dashboard · Requests · Assets · SuperAdmin (→ /admin hub page with cards)
 */
export function HorizontalNav({
  className,
  placement = "top",
}: {
  className?: string;
  placement?: "top" | "bottom";
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { menuOrder } = usePreferences();
  const [navAccess, setNavAccess] = useState<NavAccessMap>(DEFAULT_NAV_ACCESS);

  useEffect(() => {
    fetch("/api/settings?key=navAccess")
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setNavAccess(d.data);
      })
      .catch(() => {});
  }, []);

  if (!user) return null;

  const general = filterNavForUser(
    GENERAL_NAV,
    user.role,
    user.userTypes as UserType[],
    navAccess,
    menuOrder
  );

  const superItems = filterNavForUser(
    SUPERADMIN_NAV,
    user.role,
    user.userTypes as UserType[],
    navAccess
  );

  const showSuperAdmin = superItems.length > 0;
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const itemClass = (active: boolean) =>
    cn(
      "nav-item nav-item-hbar group relative flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2",
      "rounded-xl px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-[11px] sm:text-sm font-bold whitespace-nowrap min-w-[3.5rem] sm:min-w-[4.75rem]",
      "transition-all duration-150 ease-out border border-transparent touch-manipulation",
      "min-h-[44px]",
      `nav-item-hbar-${placement}`,
      active && "nav-item-hbar-active"
    );

  return (
    <nav
      className={cn("flex items-center gap-1 sm:gap-1.5 max-w-full", className)}
      aria-label="Main"
    >
      {general.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.id}
            href={item.href}
            title={item.label}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={itemClass(active)}
          >
            <span className="nav-item-icon inline-flex">
              <NavIcon name={item.icon} className="h-4 w-4" />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}

      {showSuperAdmin && (
        <Link
          href="/admin"
          title="SuperAdmin — buka halaman kartu fitur"
          aria-label="SuperAdmin"
          aria-current={isAdminRoute ? "page" : undefined}
          className={itemClass(isAdminRoute)}
        >
          <span className="nav-item-icon inline-flex">
            <Shield className="h-4 w-4 stroke-[2.25]" />
          </span>
          <span className="font-bold">SuperAdmin</span>
        </Link>
      )}
    </nav>
  );
}
