"use client";

import { Bell, LogOut, User, ChevronDown, Menu, Settings2, Search, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/providers/auth-provider";
import { useBrand } from "@/components/providers/brand-provider";
import { getInitials } from "@/lib/utils";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  playNotificationSound,
  unlockNotificationSound,
} from "@/lib/notification-sound";
import { FeatureSearch } from "./feature-search";

const iconBtn =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border-0 bg-background text-foreground cursor-pointer " +
  "transition-all duration-200 ease-out " +
  "hover:bg-accent hover:text-accent-foreground hover:scale-110 " +
  "active:scale-95 " +
  "dark:hover:bg-accent dark:hover:text-accent-foreground " +
  "[&_svg]:text-current [&_svg]:stroke-current";

export function Topbar({
  onMenuClick,
  showMenu = true,
  showBrand = false,
  children,
}: {
  onMenuClick: () => void;
  showMenu?: boolean;
  showBrand?: boolean;
  children?: ReactNode;
}) {
  const { user, logout } = useAuth();
  const { appName, logo } = useBrand();
  const [unreadCount, setUnreadCount] = useState(0);
  const prevUnreadRef = useRef<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unlock = () => unlockNotificationSound();
    window.addEventListener("pointerdown", unlock, { once: true });
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => {
      clearInterval(interval);
      window.removeEventListener("pointerdown", unlock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    function onClick(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [searchOpen]);

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications?unread=true&limit=1");
      const data = await res.json();
      if (!data.success) return;
      const next = data.unreadCount || 0;
      const prev = prevUnreadRef.current;
      if (prev !== null && next > prev) {
        playNotificationSound();
      }
      prevUnreadRef.current = next;
      setUnreadCount(next);
    } catch {
      /* ignore */
    }
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex items-center gap-1.5 sm:gap-2 border-0 bg-background text-foreground px-2 sm:px-4 md:px-6 shadow-none",
        "pt-[env(safe-area-inset-top,0px)]",
        showBrand ? "h-[64px] sm:h-[72px]" : "h-14 sm:h-16"
      )}
    >
      {/* Left section: menu + brand */}
      <div
        className={cn(
          "flex items-center gap-1.5 sm:gap-2 min-w-0 shrink-0",
          "transition-all duration-300 ease-out",
          searchOpen && "sm:opacity-0 sm:w-0 sm:overflow-hidden sm:pointer-events-none"
        )}
      >
        {showMenu && (
          <button
            type="button"
            onClick={onMenuClick}
            title="Menu"
            aria-label="Open menu"
            className={cn(iconBtn, "md:hidden shrink-0 touch-manipulation")}
          >
            <Menu className="h-5 w-5 stroke-[2.25]" />
          </button>
        )}
        {showBrand && (
          <Link
            href="/"
            title={`${appName} — Dashboard`}
            className="flex items-center gap-2 sm:gap-3 shrink-0 rounded-md px-1 py-1 hover:bg-accent transition-colors min-w-0"
          >
            <div className="relative h-11 w-11 sm:h-[70px] sm:w-[70px] shrink-0 overflow-hidden rounded-xl bg-transparent">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logo}
                alt={appName}
                className="h-full w-full object-contain"
                decoding="async"
              />
            </div>
            <span className="font-bold text-base sm:text-xl tracking-tight truncate max-w-[5.5rem] xs:max-w-[8rem] sm:max-w-[16rem] text-foreground">
              {appName}
            </span>
          </Link>
        )}
        {children}
      </div>

      {/* Desktop search: animated expand */}
      <div
        ref={searchWrapRef}
        className={cn(
          "hidden sm:flex items-center min-w-0 transition-all duration-300 ease-out",
          searchOpen
            ? "flex-1 justify-center px-2"
            : "w-auto"
        )}
      >
        {searchOpen ? (
          <div className="flex items-center gap-2 w-full max-w-xl animate-in fade-in slide-in-from-right-4 duration-300">
            <FeatureSearch className="flex-1" />
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className={cn(iconBtn, "shrink-0")}
              title="Close search"
              aria-label="Close search"
            >
              <X className="h-5 w-5 stroke-[2.25]" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className={cn(iconBtn, "shrink-0")}
            title="Search features"
            aria-label="Search features"
          >
            <Search className="h-5 w-5 stroke-[2.25]" />
          </button>
        )}
      </div>

      {/* Right section: icons + avatar */}
      <div
        className={cn(
          "flex items-center gap-0.5 sm:gap-2 shrink-0 ml-auto",
          "transition-all duration-300 ease-out",
          searchOpen && "sm:opacity-0 sm:w-0 sm:overflow-hidden sm:pointer-events-none"
        )}
      >
        {/* Mobile search: always visible on small screens */}
        <div className="sm:hidden min-w-0 flex-1 max-w-[7.5rem]">
          <FeatureSearch />
        </div>

        <Link
          href="/preferences"
          title="Preferences"
          aria-label="Preferences"
          className={cn(iconBtn, "touch-manipulation group")}
        >
          <Settings2 className="h-5 w-5 stroke-[2.25] transition-transform duration-300 ease-out group-hover:rotate-90" />
        </Link>

        <Link
          href="/notifications"
          title="Notifications"
          aria-label="Notifications"
          className={cn(iconBtn, "relative touch-manipulation group")}
          onClick={() => unlockNotificationSound()}
        >
          <Bell className="h-5 w-5 stroke-[2.25] transition-transform duration-200 ease-out group-hover:rotate-12 group-hover:-rotate-12 group-hover:animate-[wiggle_0.4s_ease-in-out]" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white animate-in zoom-in-50 duration-200">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className={
                "inline-flex items-center gap-2 rounded-md border-0 bg-background px-1.5 sm:px-2 py-1.5 text-foreground cursor-pointer touch-manipulation " +
                "transition-all duration-200 ease-out " +
                "hover:bg-accent hover:text-accent-foreground " +
                "active:scale-95 " +
                "dark:hover:bg-accent dark:hover:text-accent-foreground " +
                "min-h-[40px]"
              }
            >
              <Avatar className="h-8 w-8 transition-transform duration-200 hover:scale-105">
                <AvatarFallback className="text-xs font-bold bg-blue-600 text-white dark:bg-blue-600 dark:text-white">
                  {user ? getInitials(user.displayName) : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start text-left">
                <span className="text-sm font-bold text-foreground">{user?.displayName}</span>
                <span className="text-xs font-semibold text-primary">{user?.role}</span>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 hidden md:block stroke-[2.5] transition-transform duration-200" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-bold">{user?.displayName}</span>
                <span className="text-xs font-medium text-muted-foreground">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <Link href="/profile">
              <DropdownMenuItem className="cursor-pointer">
                <User className="mr-2 h-4 w-4 stroke-[2.25]" />
                Profile & Preferences
              </DropdownMenuItem>
            </Link>
            <Link href="/preferences">
              <DropdownMenuItem className="cursor-pointer">
                <Settings2 className="mr-2 h-4 w-4 stroke-[2.25]" />
                App Preferences
              </DropdownMenuItem>
            </Link>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-red-600 hover:text-red-700 focus:text-red-700 dark:text-red-400 dark:hover:text-red-300 dark:focus:text-red-300"
              onClick={logout}
            >
              <LogOut className="mr-2 h-4 w-4 stroke-[2.25]" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
