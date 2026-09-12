"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ColumnDef,
  loadSavedColumns,
  saveColumns,
} from "@/lib/table-prefs";

/**
 * Resizable (+ optional reorder) column state shared across tables.
 */
export function useResizableColumns<Id extends string>(
  storageKey: string,
  defaults: ColumnDef<Id>[]
) {
  const [columns, setColumns] = useState<ColumnDef<Id>[]>(() =>
    defaults.map((c) => ({ ...c }))
  );
  const dragColId = useRef<Id | null>(null);
  const resizeRef = useRef<{ id: Id; startX: number; startW: number } | null>(null);

  useEffect(() => {
    setColumns(loadSavedColumns(storageKey, defaults));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const persist = useCallback(
    (next: ColumnDef<Id>[]) => {
      setColumns(next);
      saveColumns(storageKey, next);
    },
    [storageKey]
  );

  const onHeaderDragStart = useCallback((id: Id) => {
    dragColId.current = id;
  }, []);

  const onHeaderDragOver = useCallback(
    (e: React.DragEvent, overId: Id) => {
      e.preventDefault();
      const from = dragColId.current;
      if (!from || from === overId) return;
      setColumns((prev) => {
        const next = [...prev];
        const fi = next.findIndex((c) => c.id === from);
        const ti = next.findIndex((c) => c.id === overId);
        if (fi < 0 || ti < 0) return prev;
        const [item] = next.splice(fi, 1);
        next.splice(ti, 0, item);
        dragColId.current = overId;
        saveColumns(storageKey, next);
        return next;
      });
    },
    [storageKey]
  );

  const onHeaderDragEnd = useCallback(() => {
    dragColId.current = null;
  }, []);

  const onResizeStart = useCallback(
    (e: React.MouseEvent, id: Id) => {
      e.preventDefault();
      e.stopPropagation();
      const col = columns.find((c) => c.id === id);
      if (!col) return;
      resizeRef.current = { id, startX: e.clientX, startW: col.width };

      function onMove(ev: MouseEvent) {
        const r = resizeRef.current;
        if (!r) return;
        const delta = ev.clientX - r.startX;
        setColumns((prev) =>
          prev.map((c) =>
            c.id !== r.id ? c : { ...c, width: Math.max(c.minWidth, r.startW + delta) }
          )
        );
      }

      function onUp() {
        resizeRef.current = null;
        setColumns((prev) => {
          saveColumns(storageKey, prev);
          return prev;
        });
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [columns, storageKey]
  );

  const resetColumns = useCallback(() => {
    const next = defaults.map((c) => ({ ...c }));
    persist(next);
  }, [defaults, persist]);

  const tableMinWidth = columns.reduce((s, c) => s + c.width, 0);

  return {
    columns,
    setColumns,
    persist,
    onHeaderDragStart,
    onHeaderDragOver,
    onHeaderDragEnd,
    onResizeStart,
    resetColumns,
    tableMinWidth,
  };
}
