"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/components/providers/auth-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useBrand } from "@/components/providers/brand-provider";
import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ALL_NAV,
  DEFAULT_NAV_ACCESS,
  filterNavForUser,
  type AppNavItem,
  type NavAccessMap,
} from "@/lib/nav-config";
import { NavIcon } from "./nav-icons";
import type { UserType } from "@/types";

/** Flyout menu when sidebar is collapsed — hover to open children */
function CollapsedFlyout({
  item,
  isActive,
  childActive,
}: {
  item: AppNavItem;
  isActive: (href: string) => boolean;
  childActive: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openMenu() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      setPos({ top: r.top, left: r.right + 6 });
    }
    setOpen(true);
  }

  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    function update() {
      if (wrapRef.current) {
        const r = wrapRef.current.getBoundingClientRect();
        setPos({ top: r.top, left: r.right + 6 });
      }
    }
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  const flyout: ReactNode =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed z-[200] min-w-[200px] max-w-[260px] rounded-lg border border-border/80 bg-popover p-1.5 text-popover-foreground shadow-lg"
            style={{ top: pos.top, left: pos.left }}
            onMouseEnter={openMenu}
            onMouseLeave={scheduleClose}
            role="menu"
          >
            <p className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {item.label}
            </p>
            <div className="space-y-0.5">
              {item.children!.map((child) => {
                const active = isActive(child.href);
                return (
                  <Link
                    key={child.id}
                    href={child.href}
                    role="menuitem"
                    title={child.label}
                    aria-label={child.label}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                      "text-foreground hover:bg-accent hover:text-accent-foreground",
                      active && "bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                    )}
                  >
                    <NavIcon name={child.icon} className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{child.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        title={item.label}
        aria-label={item.label}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "nav-item nav-item-sidebar flex w-full items-center justify-center rounded-lg px-2 py-2.5 text-sm font-semibold",
          "text-slate-800 dark:text-slate-100",
          (childActive || open) && "nav-item-sidebar-active"
        )}
      >
        <span className="nav-item-icon inline-flex">
          <NavIcon name={item.icon} />
        </span>
      </button>
      {flyout}
    </div>
  );
}

export function Sidebar({
  collapsed,
  onToggle,
  onNavigate,
  mobileDrawer = false,
  className,
}: {
  collapsed: boolean;
  onToggle: () => void;
  /** Called when a nav link is clicked (close mobile drawer) */
  onNavigate?: () => void;
  /** Full-width drawer mode for phones */
  mobileDrawer?: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { menuOrder } = usePreferences();
  const { appName, logo } = useBrand();
  const [navAccess, setNavAccess] = useState<NavAccessMap>(DEFAULT_NAV_ACCESS);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Smart group reset: auto-expand active group, collapse others on navigation
  useEffect(() => {
    setOpenGroups({});
  }, [pathname]);

  // Reset hover state when user explicitly toggles collapsed
  useEffect(() => {
    setHoverExpanded(false);
  }, [collapsed]);

  // Cleanup hover timer
  useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);

  const onSidebarEnter = useCallback(() => {
    if (!collapsed || mobileDrawer) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHoverExpanded(true), 150);
  }, [collapsed, mobileDrawer]);

  const onSidebarLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHoverExpanded(false), 250);
  }, []);

  const narrow = collapsed && !hoverExpanded;

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.data?.navAccess) setNavAccess(d.data.navAccess);
      })
      .catch(() => {});
  }, []);

  if (!user) return null;

  const items = filterNavForUser(
    ALL_NAV,
    user.role,
    user.userTypes as UserType[],
    navAccess,
    menuOrder
  );

  const general = items.filter((i) => i.section === "general");
  const superadmin = items.filter((i) => i.section === "superadmin");

  function isActive(href: string) {
    return pathname === href || (href !== "/" && pathname.startsWith(href));
  }

  function toggleGroup(id: string) {
    setOpenGroups((p) => ({ ...p, [id]: !p[id] }));
  }

  function renderItem(item: AppNavItem) {
    const hasChildren = !!item.children?.length;
    const childActive = item.children?.some((c) => isActive(c.href)) ?? false;
    const open = openGroups[item.id] ?? childActive;

    // Collapsed + children → hover flyout dropdown (desktop only)
    if (hasChildren && narrow && !mobileDrawer) {
      return (
        <CollapsedFlyout
          key={item.id}
          item={item}
          isActive={isActive}
          childActive={childActive}
        />
      );
    }

    // Expanded + children → accordion
    if (hasChildren && (!narrow || mobileDrawer)) {
      return (
        <div key={item.id}>
          <button
            type="button"
            title={item.label}
            aria-label={item.label}
            onClick={() => toggleGroup(item.id)}
            className={cn(
              "nav-item nav-item-sidebar flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold",
              "text-slate-800 dark:text-slate-100",
              "min-h-[44px] touch-manipulation",
              childActive && "nav-item-sidebar-active"
            )}
          >
            <span className="nav-item-icon inline-flex">
              <NavIcon name={item.icon} />
            </span>
            <span className="flex-1 text-left">{item.label}</span>
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
          </button>
          {open && (
            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-transparent pl-2">
              {item.children!.map((child) => (
                <Link
                  key={child.id}
                  href={child.href}
                  title={child.label}
                  aria-label={child.label}
                  aria-current={isActive(child.href) ? "page" : undefined}
                  onClick={() => onNavigate?.()}
                  className={cn(
                    "nav-item nav-item-sidebar flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-sm font-medium",
                    "text-slate-700 dark:text-slate-200",
                    "min-h-[44px] touch-manipulation",
                    isActive(child.href) && "nav-item-sidebar-active"
                  )}
                >
                  <span className="nav-item-icon inline-flex">
                    <NavIcon name={child.icon} className="h-3.5 w-3.5" />
                  </span>
                  <span>{child.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Leaf item
    return (
      <Link
        key={item.id}
        href={item.href}
        title={item.label}
        aria-label={item.label}
        aria-current={isActive(item.href) ? "page" : undefined}
        onClick={() => onNavigate?.()}
        className={cn(
          "nav-item nav-item-sidebar flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold",
          "text-slate-800 dark:text-slate-100",
          "min-h-[44px] touch-manipulation",
          isActive(item.href) && "nav-item-sidebar-active",
          narrow && !mobileDrawer && "justify-center px-2"
        )}
      >
        <span className="nav-item-icon inline-flex">
          <NavIcon name={item.icon} />
        </span>
        {(!narrow || mobileDrawer) && <span>{item.label}</span>}
      </Link>
    );
  }

  return (
    <aside
      data-app-sidebar
      onMouseEnter={onSidebarEnter}
      onMouseLeave={onSidebarLeave}
      className={cn(
        "h-full border-0 bg-sidebar text-sidebar-foreground flex flex-col shadow-none",
        mobileDrawer
          ? "relative w-full h-full max-h-dvh"
          : cn(
              "fixed left-0 top-0 z-40 h-screen transition-all duration-300",
              narrow ? "w-16" : "w-64",
              hoverExpanded && "shadow-xl"
            ),
        className
      )}
    >
      <Link
        href="/"
        title={`${appName} — Dashboard`}
        onClick={() => onNavigate?.()}
        className={cn(
          "nav-item nav-item-sidebar flex items-center border-0 px-3 gap-3 rounded-none shrink-0",
          narrow && !mobileDrawer ? "h-[72px] justify-center px-2" : "h-[72px] px-4"
        )}
      >
        <div className="relative h-[56px] w-[56px] sm:h-[70px] sm:w-[70px] shrink-0 overflow-hidden rounded-xl bg-transparent">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo}
            alt={appName}
            className="h-full w-full object-contain"
            decoding="async"
          />
        </div>
        {(!narrow || mobileDrawer) && (
          <span className="font-bold text-lg sm:text-xl tracking-tight truncate text-sidebar-foreground">
            {appName}
          </span>
        )}
      </Link>

      <ScrollArea className="flex-1 py-3 sm:py-4 min-h-0">
        <nav className="space-y-6 px-2 pb-4">
          <div>
            {(!narrow || mobileDrawer) && (
              <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                General
              </p>
            )}
            <div className="space-y-1">{general.map(renderItem)}</div>
          </div>

          {superadmin.length > 0 && (
            <div>
              {(!narrow || mobileDrawer) && (
                <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  SuperAdmin
                </p>
              )}
              <div className="space-y-1">{superadmin.map(renderItem)}</div>
            </div>
          )}
        </nav>
      </ScrollArea>

      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-center h-12 min-h-[48px] border-0 hover:bg-sidebar-accent transition-colors shrink-0 touch-manipulation safe-bottom"
        title={
          mobileDrawer
            ? "Close menu"
            : collapsed
              ? "Expand sidebar"
              : "Collapse sidebar"
        }
        aria-label={mobileDrawer ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform",
            mobileDrawer ? "rotate-90" : collapsed ? "rotate-[-90deg]" : "rotate-90"
          )}
        />
      </button>
    </aside>
  );
}
