"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CornerDownLeft, History, Search, Sparkles, X } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { DEFAULT_NAV_ACCESS, type NavAccessMap } from "@/lib/nav-config";
import {
  getSearchableFeatures,
  searchFeatures,
  type SearchableFeature,
} from "@/lib/nav-search";
import { NavIcon } from "./nav-icons";
import type { UserType } from "@/types";
import { cn } from "@/lib/utils";

const RECENT_KEY = "nexusdesk-search-recent";
const RECENT_MAX = 5;
const QUICK_MAX = 6;

const SECTION_LABEL: Record<SearchableFeature["section"], string> = {
  general: "App",
  account: "Account",
  superadmin: "Admin",
};

function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function pushRecent(id: string): string[] {
  const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
/** Bold the parts of `text` that matched the typed tokens */
function Highlight({ text, query }: { text: string; query: string }) {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return <>{text}</>;

  const lower = text.toLowerCase();
  const hit = new Array<boolean>(text.length).fill(false);
  for (const t of tokens) {
    for (let i = lower.indexOf(t); i >= 0; i = lower.indexOf(t, i + t.length)) {
      for (let k = i; k < i + t.length; k++) hit[k] = true;
    }
  }

  const out: ReactNode[] = [];
  let buf = "";
  let on = false;
  const flush = () => {
    if (!buf) return;
    out.push(
      on ? (
        <b key={out.length} className="font-bold text-blue-700 dark:text-blue-300">
          {buf}
        </b>
      ) : (
        <span key={out.length}>{buf}</span>
      )
    );
    buf = "";
  };
  for (let i = 0; i < text.length; i++) {
    if (hit[i] !== on) {
      flush();
      on = hit[i];
    }
    buf += text[i];
  }
  flush();
  return <>{out}</>;
}

/**
 * Feature search — one command palette shared by every navbar mode
 * (sidebar / top / bottom). Trigger collapses to an icon on phones.
 * Shortcuts: Ctrl/Cmd+K anywhere, "/" when not typing in a field.
 */
export function FeatureSearch({ className }: { className?: string }) {
  const { user } = useAuth();
  const { menuOrder } = usePreferences();
  const router = useRouter();

  const [navAccess, setNavAccess] = useState<NavAccessMap>(DEFAULT_NAV_ACCESS);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [metaKey, setMetaKey] = useState("Ctrl");

  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const idPrefix = useId().replace(/:/g, "");
  const listId = `${idPrefix}-results`;
  const optionId = (key: string) => `${idPrefix}-opt-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  useEffect(() => {
    fetch("/api/settings?key=navAccess")
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setNavAccess(d.data);
      })
      .catch(() => {});
    const t = setTimeout(() => {
      setRecentIds(readRecent());
      if (/Mac|iPhone|iPad/i.test(navigator.userAgent)) setMetaKey("⌘");
    }, 0);
    return () => clearTimeout(t);
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
  const typing = query.trim().length > 0;

  const recent = useMemo(
    () =>
      recentIds
        .map((id) => catalog.find((f) => f.id === id))
        .filter((f): f is SearchableFeature => !!f),
    [recentIds, catalog]
  );

  const quick = useMemo(
    () =>
      catalog
        .filter((f) => f.section === "general" && !recentIds.includes(f.id))
        .slice(0, QUICK_MAX),
    [catalog, recentIds]
  );

  /** Sections shown in the panel — empty query falls back to recent + shortcuts */
  const groups = useMemo(() => {
    if (!typing) {
      const g: { key: string; label: string; items: SearchableFeature[] }[] = [];
      if (recent.length) g.push({ key: "recent", label: "Recent", items: recent });
      if (quick.length) g.push({ key: "quick", label: "Jump to", items: quick });
      return g;
    }
    const bySection = new Map<string, SearchableFeature[]>();
    for (const f of results) {
      const arr = bySection.get(f.section);
      if (arr) arr.push(f);
      else bySection.set(f.section, [f]);
    }
    return [...bySection.entries()].map(([key, items]) => ({
      key,
      label: SECTION_LABEL[key as SearchableFeature["section"]] ?? "App",
      items,
    }));
  }, [typing, results, recent, quick]);
  /** Flat list the arrow keys walk through, keyed per group to stay unique */
  const flat = useMemo(
    () => groups.flatMap((g) => g.items.map((f) => ({ key: `${g.key}:${f.id}`, f }))),
    [groups]
  );
  const idxOf = useMemo(
    () => new Map(flat.map((row, i) => [row.key, i])),
    [flat]
  );

  const updateQuery = (value: string) => {
    setQuery(value);
    setActiveIdx(0);
  };

  // Global shortcuts: Ctrl/Cmd+K toggles, "/" opens when not typing
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      const t = e.target as HTMLElement | null;
      const inField =
        !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (key === "/" && !inField && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Open: refresh recents, lock page scroll, focus the field
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const recentTimer = setTimeout(() => setRecentIds(readRecent()), 0);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => {
      clearTimeout(recentTimer);
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus();
      setQuery("");
      setActiveIdx(0);
    };
  }, [open]);

  // Keep the highlighted row visible
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open, query]);

  const go = useCallback(
    (f: SearchableFeature) => {
      setOpen(false);
      setRecentIds(pushRecent(f.id));
      router.push(f.href);
    },
    [router]
  );
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Tab") {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'input, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (!flat.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIdx(flat.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = flat[activeIdx];
      if (row) go(row.f);
    }
  }

  if (!user) return null;

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      title={`Search features (${metaKey}+K)`}
      aria-label="Search features"
      aria-keyshortcuts="Control+K Meta+K"
      className={cn(
        "group inline-flex h-10 min-w-0 items-center gap-2 rounded-xl border border-border",
        "bg-muted/50 text-muted-foreground cursor-pointer touch-manipulation",
        "w-10 shrink-0 justify-center px-0",
        "sm:w-full sm:flex-1 sm:shrink sm:justify-start sm:px-3",
        "transition-colors hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
        className
      )}
    >
      <Search className="h-4 w-4 shrink-0 stroke-[2.25]" />
      <span className="hidden sm:block flex-1 truncate text-left text-sm">
        Search features…
      </span>
      <span className="hidden lg:flex shrink-0 items-center gap-1">
        <span className="cmd-kbd">{metaKey}</span>
        <span className="cmd-kbd">K</span>
      </span>
    </button>
  );
  const panel =
    open && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[200] flex items-start justify-center p-3 sm:p-6 sm:pt-[12vh]">
            <div
              className="cmd-overlay absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Search features"
              onKeyDown={onKeyDown}
              className={cn(
                "cmd-panel relative flex w-full max-w-2xl flex-col overflow-hidden",
                "max-h-[86dvh] sm:max-h-[68dvh] rounded-2xl bg-popover text-popover-foreground shadow-2xl"
              )}
            >
              <div className="flex items-center gap-2.5 px-3.5 py-3">
                <Search className="h-4 w-4 shrink-0 stroke-[2.25] text-muted-foreground" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => updateQuery(e.target.value)}
                  placeholder="Search features, pages, settings…"
                  className={cn(
                    "min-w-0 flex-1 bg-transparent text-[15px] text-foreground",
                    "placeholder:text-muted-foreground focus:outline-none"
                  )}
                  aria-label="Search features"
                  role="combobox"
                  aria-expanded={open}
                  aria-autocomplete="list"
                  aria-controls={listId}
                  aria-activedescendant={
                    flat[activeIdx] ? optionId(flat[activeIdx].key) : undefined
                  }
                  autoComplete="off"
                  spellCheck={false}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      updateQuery("");
                      inputRef.current?.focus();
                    }}
                    className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="h-px bg-border" />
              <div
                ref={listRef}
                id={listId}
                role="listbox"
                aria-label="Search results"
                className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3"
              >
                {flat.length === 0 ? (
                  <div className="flex min-h-40 flex-col items-center justify-center px-6 py-10 text-center">
                    <Search className="mb-3 h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium text-foreground">
                      {typing ? `No features match “${query.trim()}”` : "No features available"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {typing
                        ? "Try another name, page, or setting."
                        : "Your role does not currently have searchable pages."}
                    </p>
                  </div>
                ) : (
                  groups.map((group) => (
                    <section key={group.key} aria-labelledby={`${listId}-${group.key}`}>
                      <div
                        id={`${listId}-${group.key}`}
                        className="flex items-center gap-2 px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {group.key === "recent" ? (
                          <History className="h-3.5 w-3.5" />
                        ) : group.key === "quick" ? (
                          <Sparkles className="h-3.5 w-3.5" />
                        ) : null}
                        {group.label}
                      </div>
                      <div className="pb-1">
                        {group.items.map((feature) => {
                          const key = `${group.key}:${feature.id}`;
                          const index = idxOf.get(key) ?? 0;
                          const active = index === activeIdx;
                          return (
                            <button
                              key={key}
                              id={optionId(key)}
                              type="button"
                              role="option"
                              aria-selected={active}
                              data-active={active}
                              onMouseEnter={() => setActiveIdx(index)}
                              onClick={() => go(feature)}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                                active
                                  ? "bg-accent text-accent-foreground"
                                  : "hover:bg-accent/70 hover:text-accent-foreground"
                              )}
                            >
                              <NavIcon name={feature.icon} className="h-4 w-4 shrink-0" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">
                                  <Highlight text={feature.label} query={query} />
                                </span>
                                {feature.group && (
                                  <span className="block truncate text-xs text-muted-foreground">
                                    <Highlight text={feature.group} query={query} />
                                  </span>
                                )}
                              </span>
                              <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                                {SECTION_LABEL[feature.section]}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))
                )}
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border px-3.5 py-2 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="cmd-kbd">↑</span>
                    <span className="cmd-kbd">↓</span>
                    Navigate
                  </span>
                  <span className="hidden items-center gap-1 sm:flex">
                    <CornerDownLeft className="h-3.5 w-3.5" />
                    Open
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <span className="cmd-kbd">Esc</span>
                  Close
                </span>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {trigger}
      {panel}
    </>
  );
}