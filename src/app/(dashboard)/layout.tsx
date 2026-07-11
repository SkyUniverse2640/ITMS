"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { AppShell } from "@/components/layout/app-shell";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Dashboard shell gate.
 *
 * Blink fix: never set gateOk → false after AppShell has mounted.
 * Previously SuperAdmin re-fetched /api/onboarding on every pathname change
 * and briefly unmounted the entire shell (Loading spinner flash).
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [gateOk, setGateOk] = useState(false);
  /** Only cache "complete" (false). "needed" is re-checked so finish-onboarding works. */
  const onboardingCompleteRef = useRef(false);
  const checkingRef = useRef(false);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.mustChangePassword) {
      router.replace("/change-password");
      return;
    }

    if (user.role !== "SuperAdmin") {
      setGateOk(true);
      return;
    }

    if (pathname.startsWith("/admin/onboarding")) {
      setGateOk(true);
      // Leaving onboarding later must re-verify
      onboardingCompleteRef.current = false;
      return;
    }

    // Session already verified: onboarding done → stay stable across navigations
    if (onboardingCompleteRef.current) {
      setGateOk(true);
      return;
    }

    if (checkingRef.current) return;
    checkingRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (data.success && data.data?.needsOnboarding) {
          router.replace("/admin/onboarding");
          return;
        }
        onboardingCompleteRef.current = true;
        setGateOk(true);
      } catch {
        if (!cancelled) {
          // Fail open so shell still works offline
          onboardingCompleteRef.current = true;
          setGateOk(true);
        }
      } finally {
        checkingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading, router, pathname]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!gateOk) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <div key={pathname} className="page-enter min-w-0 w-full">
        {children}
      </div>
    </AppShell>
  );
}
