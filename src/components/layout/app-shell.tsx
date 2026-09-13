"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { HorizontalNav } from "./horizontal-nav";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/components/providers/preferences-provider";

const SIDEBAR_COLLAPSED_KEY = "itms-sidebar-collapsed";
const CONSTRAINED_DESKTOP_QUERY = "(min-width: 768px) and (max-width: 1279px)";

type SidebarPreference = "collapsed" | "expanded" | null;

function MobileDrawer({
  open,
  onOpenChange,
  triggerRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Overlay className="mobile-drawer-overlay fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] md:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
          className="mobile-drawer-content fixed inset-y-0 left-0 z-50 w-[min(18rem,88vw)] shadow-xl outline-none md:hidden"
        >
          <Dialog.Title className="sr-only">Main navigation</Dialog.Title>
          <Sidebar
            collapsed={false}
            onToggle={() => onOpenChange(false)}
            onNavigate={() => onOpenChange(false)}
            mobileDrawer
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { navLayout, mounted } = usePreferences();
  const pathname = usePathname();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [sidebarPreference, setSidebarPreference] = useState<SidebarPreference>(null);
  const [autoSidebarCollapsed, setAutoSidebarCollapsed] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState({ pathname, open: false });

  const layout = mounted ? navLayout : "sidebar";
  const mobileOpen = mobileDrawer.pathname === pathname && mobileDrawer.open;
  const sidebarCollapsed =
    sidebarPreference === "collapsed" ||
    (sidebarPreference === null && autoSidebarCollapsed);

  useEffect(() => {
    const mediaQuery = window.matchMedia(CONSTRAINED_DESKTOP_QUERY);
    const syncSidebar = () => {
      const savedPreference = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      setSidebarPreference(
        savedPreference === "true"
          ? "collapsed"
          : savedPreference === "false"
            ? "expanded"
            : null
      );
      setAutoSidebarCollapsed(mediaQuery.matches);
    };
    const initialSync = window.setTimeout(syncSidebar, 0);
    mediaQuery.addEventListener("change", syncSidebar);
    return () => {
      window.clearTimeout(initialSync);
      mediaQuery.removeEventListener("change", syncSidebar);
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const closeDesktopDrawer = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileDrawer({ pathname, open: false });
    };
    mediaQuery.addEventListener("change", closeDesktopDrawer);
    return () => mediaQuery.removeEventListener("change", closeDesktopDrawer);
  }, [pathname]);

  function toggleSidebar() {
    const preference = sidebarCollapsed ? "expanded" : "collapsed";
    setSidebarPreference(preference);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(preference === "collapsed"));
  }

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
          onMenuClick={() => setMobileDrawer({ pathname, open: true })}
          menuButtonRef={menuButtonRef}
          menuOpen={mobileOpen}
          showMenu
          showBrand
        >
          <div className="hidden md:flex min-w-0 overflow-x-auto ml-1 sm:ml-2 scrollbar-none">
            <HorizontalNav placement="top" className="justify-start" />
          </div>
        </Topbar>

        <MobileDrawer
          open={mobileOpen}
          onOpenChange={(open) => setMobileDrawer({ pathname, open })}
          triggerRef={menuButtonRef}
        />

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
          onToggle={toggleSidebar}
        />
      </div>

      <MobileDrawer
        open={mobileOpen}
        onOpenChange={(open) => setMobileDrawer({ pathname, open })}
        triggerRef={menuButtonRef}
      />

      <div
        className={cn(
          "transition-all duration-300 min-w-0 max-w-full",
          sidebarCollapsed ? "md:ml-16" : "md:ml-64"
        )}
      >
        <Topbar
          onMenuClick={() => setMobileDrawer({ pathname, open: true })}
          menuButtonRef={menuButtonRef}
          menuOpen={mobileOpen}
        />
        <main className="p-3 sm:p-4 md:p-6 min-w-0 main-scroll-x w-full max-w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
