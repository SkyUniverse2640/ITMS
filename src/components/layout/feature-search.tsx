"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import {
  DEFAULT_NAV_ACCESS,
  type NavAccessMap,
} from "@/lib/nav-config";
import {
  getSearchableFeatures,
  searchFeatures,
  type SearchableFeature,
} from "@/lib/nav-search";
import { NavIcon } from "./nav-icons";
import type { UserType } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Header "Search Feature" — only lists pages allowed for current Role + User Types.
 */
export function FeatureSearch({ className }: { className?: string }) {
  const { user } = useAuth();
  const { menuOrder } = usePreferences();
  const router = useRouter();
  const [navAccess, setNavAccess] = useState<NavAccessMap>(DEFAULT_NAV_ACCESS);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/settings?key=navAccess")
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setNavAccess(d.data);
      })
      .catch(() => {});
  }, []);

  const catalog = useMemo(() => {
    if (!user) return [] as SearchableFeature[];
    return getSearchableFeatures(
      user.role,
      user.userTypes as UserType[],
      navAccess,
      menuOrder
    );
  }, [user, navAccess, menuOrder]);

  const results = useMemo(() => searchFeatures(catalog, query), [catalog, query]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function go(feature: SearchableFeature) {
    setQuery("");
    setOpen(false);
    router.push(feature.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter") && query.trim()) {
      setOpen(true);
    }
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const f = results[activeIdx];
      if (f) go(f);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  if (!user) return null;

  const showPanel = open && query.trim().length > 0;

  return (
    <div ref={wrapRef} className={cn("relative min-w-0 flex-1 max-w-md", className)}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none stroke-[2.25]" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search Feature..."
          className={cn(
            "w-full h-10 rounded-md border-0 bg-muted/60 pl-9 pr-8 text-sm text-foreground",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:bg-muted",
            "transition-colors"
          )}
          aria-label="Search Feature"
          aria-expanded={showPanel}
          aria-controls="feature-search-results"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showPanel && (
        <div
          id="feature-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 z-[100] max-h-80 overflow-y-auto rounded-lg border border-border/80 bg-popover text-popover-foreground shadow-lg"
        >
          {results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground text-center">
              No features match &quot;{query.trim()}&quot; for your role
            </p>
          ) : (
            <ul className="p-1">
              {results.map((f, i) => (
                <li key={f.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === activeIdx}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                      i === activeIdx
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent hover:text-accent-foreground"
                    )}
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => go(f)}
                  >
                    <NavIcon name={f.icon} className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium truncate">{f.label}</span>
                      {f.group && (
                        <span className="block text-[11px] text-muted-foreground truncate">
                          {f.group}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
                      {f.section === "superadmin"
                        ? "Admin"
                        : f.section === "account"
                          ? "Account"
                          : "App"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
