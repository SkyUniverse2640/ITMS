/** Client helpers for resizable/reorderable tables + page size (localStorage). */

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 75, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export interface ColumnDef<Id extends string = string> {
  id: Id;
  label: string;
  width: number;
  minWidth: number;
}

export function loadPageSize(storageKey: string, fallback: PageSize = 25): PageSize {
  if (typeof window === "undefined") return fallback;
  try {
    const n = parseInt(localStorage.getItem(storageKey) || String(fallback), 10);
    return PAGE_SIZE_OPTIONS.includes(n as PageSize) ? (n as PageSize) : fallback;
  } catch {
    return fallback;
  }
}

export function savePageSize(storageKey: string, n: number) {
  try {
    localStorage.setItem(storageKey, String(n));
  } catch {
    /* ignore */
  }
}

export function loadSavedColumns<Id extends string>(
  storageKey: string,
  defaults: ColumnDef<Id>[]
): ColumnDef<Id>[] {
  if (typeof window === "undefined") return defaults.map((c) => ({ ...c }));
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaults.map((c) => ({ ...c }));
    const parsed = JSON.parse(raw) as { order?: string[]; widths?: Record<string, number> };
    const byId = new Map(defaults.map((c) => [c.id, { ...c }]));
    const order = Array.isArray(parsed.order)
      ? (parsed.order.filter((id) => byId.has(id as Id)) as Id[])
      : defaults.map((c) => c.id);
    for (const c of defaults) {
      if (!order.includes(c.id)) order.push(c.id);
    }
    return order.map((id) => {
      const base = byId.get(id)!;
      const w = parsed.widths?.[id];
      return {
        ...base,
        width: typeof w === "number" && w >= base.minWidth ? w : base.width,
      };
    });
  } catch {
    return defaults.map((c) => ({ ...c }));
  }
}

export function saveColumns<Id extends string>(storageKey: string, cols: ColumnDef<Id>[]) {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        order: cols.map((c) => c.id),
        widths: Object.fromEntries(cols.map((c) => [c.id, c.width])),
      })
    );
  } catch {
    /* ignore */
  }
}
