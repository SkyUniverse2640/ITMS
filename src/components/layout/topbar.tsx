"use client";

import { Bell, LogOut, User, ChevronDown, Menu, Settings2 } from "lucide-react";
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
  "hover:bg-accent hover:text-accent-foreground " +
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

  useEffect(() => {
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

    const unlock = () => unlockNotificationSound();
    window.addEventListener("pointerdown", unlock, { once: true });
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => {
      clearInterval(interval);
      window.removeEventListener("pointerdown", unlock);
    };
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex items-center gap-1.5 sm:gap-2 border-0 bg-background text-foreground px-2 sm:px-4 md:px-6 shadow-none",
        "pt-[env(safe-area-inset-top,0px)]",
        showBrand ? "h-[64px] sm:h-[72px]" : "h-14 sm:h-16"
      )}
    >
      {/* Left section: menu + brand */}
      <div className="flex flex-1 items-center gap-1.5 sm:gap-2 min-w-0">
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
            className="flex items-center gap-2 sm:gap-3 shrink-0 rounded-md px-1 py-1 hover:bg-accent min-w-0"
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

      <div className="flex w-10 shrink-0 justify-center min-w-0 px-0 sm:w-auto sm:flex-1 sm:px-2">
        <FeatureSearch className="max-w-xl" />
      </div>

      {/* Right section: icons + avatar */}
      <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
        <Link
          href="/preferences"
          title="Preferences"
          aria-label="Preferences"
          className={cn(iconBtn, "touch-manipulation")}
        >
          <Settings2 className="h-5 w-5 stroke-[2.25]" />
        </Link>

        <Link
          href="/notifications"
          title="Notifications"
          aria-label="Notifications"
          className={cn(iconBtn, "relative touch-manipulation")}
          onClick={() => unlockNotificationSound()}
        >
          <Bell className="h-5 w-5 stroke-[2.25]" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
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
                "hover:bg-accent hover:text-accent-foreground " +
                "dark:hover:bg-accent dark:hover:text-accent-foreground " +
                "min-h-[40px]"
              }
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs font-bold bg-blue-600 text-white dark:bg-blue-600 dark:text-white">
                  {user ? getInitials(user.displayName) : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start text-left">
                <span className="text-sm font-bold text-foreground">{user?.displayName}</span>
                <span className="text-xs font-semibold text-primary">{user?.role}</span>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 hidden md:block stroke-[2.5]" />
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
