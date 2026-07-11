"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { HorizontalNav } from "./horizontal-nav";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/components/providers/preferences-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { navLayout, mounted } = usePreferences();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const layout = mounted ? navLayout : "sidebar";

  // Close mobile drawer on navigation (critical for phone UX)
  // Do not remount shell or toggle layout here — that causes blink between features.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll while mobile drawer is open
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.classList.add("mobile-drawer-open");
    document.body.style.overflow = "hidden";
    return () => {
      document.body.classList.remove("mobile-drawer-open");
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  // Bottom bar: logo + name in topbar; nav at bottom (mobile-friendly)
  if (layout === "bottom") {
    return (
      <div className="min-h-dvh min-h-screen bg-background flex flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]">
        <Topbar onMenuClick={() => {}} showMenu={false} showBrand />
        <main className="flex-1 p-3 sm:p-4 md:p-6 min-w-0 main-scroll-x w-full max-w-full">
          {children}
        </main>
        <div className="fixed bottom-0 inset-x-0 z-40 border-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-bottom">
          <HorizontalNav
            placement="bottom"
            className="justify-around px-1 py-1.5 max-w-lg mx-auto overflow-x-auto"
          />
        </div>
      </div>
    );
  }

  // Top bar: logo + name + horizontal nav (scrollable on mobile)
  if (layout === "top") {
    return (
      <div className="min-h-dvh min-h-screen bg-background flex flex-col">
        <Topbar
          onMenuClick={() => setMobileOpen((o) => !o)}
          showMenu
          showBrand
        >
          <div className="hidden md:flex min-w-0 overflow-x-auto ml-1 sm:ml-2 scrollbar-none">
            <HorizontalNav placement="top" className="justify-start" />
          </div>
        </Topbar>

        {/* Mobile: slide-over full nav (same links as desktop top bar + SuperAdmin) */}
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <div className="fixed inset-y-0 left-0 z-50 w-[min(18rem,88vw)] md:hidden shadow-xl">
              <Sidebar
                collapsed={false}
                onToggle={() => setMobileOpen(false)}
                onNavigate={() => setMobileOpen(false)}
                mobileDrawer
              />
            </div>
          </>
        )}

        <main className="flex-1 p-3 sm:p-4 md:p-6 max-w-7xl mx-auto w-full min-w-0 main-scroll-x">
          {children}
        </main>
      </div>
    );
  }

  // Default: sidebar — desktop fixed rail + mobile drawer
  return (
    <div className="min-h-dvh min-h-screen bg-background">
      <div className="hidden md:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div
            className={cn(
              "fixed inset-y-0 left-0 z-50 w-[min(18rem,88vw)] md:hidden",
              "shadow-xl animate-in slide-in-from-left duration-200"
            )}
          >
            <Sidebar
              collapsed={false}
              onToggle={() => setMobileOpen(false)}
              onNavigate={() => setMobileOpen(false)}
              mobileDrawer
            />
          </div>
        </>
      )}

      <div
        className={cn(
          "transition-all duration-300 min-w-0 max-w-full",
          sidebarCollapsed ? "md:ml-16" : "md:ml-64"
        )}
      >
        <Topbar onMenuClick={() => setMobileOpen((o) => !o)} />
        <main className="p-3 sm:p-4 md:p-6 min-w-0 main-scroll-x w-full max-w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
