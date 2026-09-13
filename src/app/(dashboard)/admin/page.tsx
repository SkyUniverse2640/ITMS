"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/components/providers/auth-provider";
import {
  SUPERADMIN_NAV,
  DEFAULT_NAV_ACCESS,
  filterNavForUser,
  type NavAccessMap,
} from "@/lib/nav-config";
import { NavIcon } from "@/components/layout/nav-icons";
import type { UserType } from "@/types";
import { ArrowLeft, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SuperAdmin hub — full-page cards (used from Top / Bottom nav layouts).
 * Not a dropdown: each management group is a card with feature links.
 */
export default function SuperAdminHubPage() {
  const { user } = useAuth();
  const pathname = usePathname();
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

  const superItems = filterNavForUser(
    SUPERADMIN_NAV,
    user.role,
    user.userTypes as UserType[],
    navAccess
  );

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  if (superItems.length === 0) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 py-8 text-center">
        <Shield className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
        <h1 className="text-xl font-bold">SuperAdmin</h1>
        <p className="text-muted-foreground text-sm">
          You don&apos;t have access to SuperAdmin features.
        </p>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="SuperAdmin"
        icon={<Shield className="h-6 w-6" />}
        description="Management hub — pilih kartu fitur di bawah"
        backAction={
          <Link href="/">
            <Button variant="ghost" size="icon" title="Back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {superItems.map((group) => {
          const links = group.children?.length
            ? group.children
            : [
                {
                  id: group.id,
                  label: group.label,
                  href: group.href,
                  icon: group.icon,
                },
              ];
          const groupActive = links.some((l) => isActive(l.href));

          return (
            <Card
              key={group.id}
              className={cn(
                "overflow-hidden transition-shadow hover:shadow-md",
                groupActive && "ring-2 ring-primary/25 bg-primary/5"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="icon-tile flex h-10 w-10 items-center justify-center rounded-lg shrink-0">
                    <NavIcon name={group.icon} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base">{group.label}</CardTitle>
                    <CardDescription className="text-xs">
                      {links.length} fitur
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 pt-0">
                {links.map((link) => {
                  const active = isActive(link.href);
                  const label = link.label === "Open" ? group.label : link.label;
                  return (
                    <Link
                      key={link.id}
                      href={link.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                        active
                          ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                          : "text-foreground"
                      )}
                    >
                      <NavIcon name={link.icon} className="h-4 w-4 shrink-0" />
                      <span className="truncate">{label}</span>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
