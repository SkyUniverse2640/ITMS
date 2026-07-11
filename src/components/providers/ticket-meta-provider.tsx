"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/** Event name — fire after ticket settings colors change so all pages refresh. */
export const TICKET_META_CHANGED = "ticket-meta-changed";

export function notifyTicketMetaChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(TICKET_META_CHANGED));
  }
}

/** Fallback hex when settings not loaded / name unknown (matches seed defaults). */
export const FALLBACK_STATUS_HEX: Record<string, string> = {
  "Pending Approval": "#8B5CF6",
  Open: "#3B82F6",
  "On Hold": "#6B7280",
  "In Progress": "#F59E0B",
  Closed: "#64748B",
  Reject: "#EF4444",
  // legacy
  Resolved: "#64748B",
  Reopened: "#3B82F6",
  Rejected: "#EF4444",
};

export const FALLBACK_PRIORITY_HEX: Record<string, string> = {
  "Very Low": "#94A3B8",
  Low: "#3B82F6",
  Normal: "#22C55E",
  High: "#F97316",
  "Very High": "#EF4444",
};

type NamedColor = { name?: string; color?: string };

function toColorMap(raw: unknown, fallback: Record<string, string>): Record<string, string> {
  const map: Record<string, string> = { ...fallback };
  if (!Array.isArray(raw)) return map;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { name, color } = item as NamedColor;
    if (typeof name === "string" && name && typeof color === "string" && color) {
      map[name] = color;
    }
  }
  return map;
}

export function colorBadgeStyle(hex?: string): CSSProperties {
  const bg = hex && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex) ? hex : "#64748B";
  return {
    backgroundColor: bg,
    color: "#ffffff",
    borderColor: "transparent",
  };
}

interface TicketMetaContextType {
  statusColors: Record<string, string>;
  priorityColors: Record<string, string>;
  getStatusColor: (name?: string | null) => string;
  getPriorityColor: (name?: string | null) => string;
  reload: () => Promise<void>;
  ready: boolean;
}

const TicketMetaContext = createContext<TicketMetaContextType>({
  statusColors: FALLBACK_STATUS_HEX,
  priorityColors: FALLBACK_PRIORITY_HEX,
  getStatusColor: (name) => (name && FALLBACK_STATUS_HEX[name]) || "#64748B",
  getPriorityColor: (name) => (name && FALLBACK_PRIORITY_HEX[name]) || "#64748B",
  reload: async () => {},
  ready: false,
});

export function TicketMetaProvider({ children }: { children: ReactNode }) {
  const [statusColors, setStatusColors] = useState<Record<string, string>>(FALLBACK_STATUS_HEX);
  const [priorityColors, setPriorityColors] = useState<Record<string, string>>(FALLBACK_PRIORITY_HEX);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [st, pr] = await Promise.all([
        fetch("/api/settings?key=ticketStatuses").then((r) => r.json()),
        fetch("/api/settings?key=priorities").then((r) => r.json()),
      ]);
      if (st?.success) setStatusColors(toColorMap(st.data, FALLBACK_STATUS_HEX));
      if (pr?.success) setPriorityColors(toColorMap(pr.data, FALLBACK_PRIORITY_HEX));
    } catch {
      /* keep fallbacks */
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    reload();
    const onChange = () => {
      void reload();
    };
    const onFocus = () => {
      void reload();
    };
    window.addEventListener(TICKET_META_CHANGED, onChange);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener(TICKET_META_CHANGED, onChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [reload]);

  const value = useMemo<TicketMetaContextType>(
    () => ({
      statusColors,
      priorityColors,
      getStatusColor: (name) =>
        (name && statusColors[name]) || (name && FALLBACK_STATUS_HEX[name]) || "#64748B",
      getPriorityColor: (name) =>
        (name && priorityColors[name]) || (name && FALLBACK_PRIORITY_HEX[name]) || "#64748B",
      reload,
      ready,
    }),
    [statusColors, priorityColors, reload, ready]
  );

  return <TicketMetaContext.Provider value={value}>{children}</TicketMetaContext.Provider>;
}

export function useTicketMeta() {
  return useContext(TicketMetaContext);
}
