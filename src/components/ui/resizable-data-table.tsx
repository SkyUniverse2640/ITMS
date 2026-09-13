"use client";

import * as React from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { type ColumnDef } from "@/lib/table-prefs";
import { useResizableColumns } from "@/hooks/use-resizable-columns";
import { ColumnResizeHandle, TruncateTooltip } from "@/components/ui/truncate-tooltip";

export interface ResizableDataTableColumn<T, Id extends string = string> extends ColumnDef<Id> {
  /** Plain text for tooltip when cell truncates */
  getTooltip?: (row: T) => string;
  /** Cell renderer (wrapped with truncate + tooltip if getTooltip provided) */
  render: (row: T) => React.ReactNode;
  /** Disable drag reorder for this column */
  fixed?: boolean;
}

interface ResizableDataTableProps<T, Id extends string> {
  storageKey: string;
  columns: ResizableDataTableColumn<T, Id>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Optional trailing actions column width */
  actionsWidth?: number;
  renderActions?: (row: T) => React.ReactNode;
  emptyMessage?: string;
  className?: string;
  /** Allow column reorder via drag (default true) */
  reorderable?: boolean;
}

export function ResizableDataTable<T, Id extends string>({
  storageKey,
  columns: columnDefs,
  rows,
  rowKey,
  onRowClick,
  actionsWidth = 0,
  renderActions,
  emptyMessage = "No data",
  className,
  reorderable = true,
}: ResizableDataTableProps<T, Id>) {
  const defaults = React.useMemo(
    () =>
      columnDefs.map((c) => ({
        id: c.id,
        label: c.label,
        width: c.width,
        minWidth: c.minWidth,
      })),
    [columnDefs]
  );

  const {
    columns,
    onHeaderDragStart,
    onHeaderDragOver,
    onHeaderDragEnd,
    onResizeStart,
    tableMinWidth,
  } = useResizableColumns(storageKey, defaults);

  const renderMap = React.useMemo(() => {
    const m = new Map<string, ResizableDataTableColumn<T, Id>>();
    for (const c of columnDefs) m.set(c.id, c);
    return m;
  }, [columnDefs]);

  const totalWidth = tableMinWidth + (renderActions ? actionsWidth || 88 : 0);

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-10 text-sm">{emptyMessage}</p>
    );
  }

  return (
    <div className={cn("relative w-full overflow-auto", className)}>
      <table
        className="caption-bottom text-sm border-collapse"
        style={{ tableLayout: "fixed", width: totalWidth, minWidth: "100%" }}
      >
        <thead>
          <tr className="border-b">
            {columns.map((col) => {
              const def = renderMap.get(col.id);
              return (
                <th
                  key={col.id}
                  draggable={reorderable && !def?.fixed}
                  onDragStart={() => reorderable && !def?.fixed && onHeaderDragStart(col.id)}
                  onDragOver={(e) => reorderable && onHeaderDragOver(e, col.id)}
                  onDragEnd={onHeaderDragEnd}
                  className={cn(
                    "relative h-12 px-3 text-left align-middle font-bold text-foreground select-none",
                    "bg-background sticky top-0 z-[1]"
                  )}
                  style={{ width: col.width, minWidth: col.minWidth }}
                >
                  <div className="flex items-center gap-1 pr-2">
                    {reorderable && !def?.fixed && (
                      <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground cursor-grab active:cursor-grabbing" />
                    )}
                    <TruncateTooltip text={col.label} className="font-bold">
                      {col.label}
                    </TruncateTooltip>
                  </div>
                  <ColumnResizeHandle onMouseDown={(e) => onResizeStart(e, col.id)} />
                </th>
              );
            })}
            {renderActions && (
              <th
                className="h-12 px-3 text-right align-middle font-bold text-foreground bg-background sticky top-0 z-[1]"
                style={{ width: actionsWidth || 88 }}
              >
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={cn(
                "border-b transition-colors hover:bg-muted/60",
                onRowClick && "cursor-pointer"
              )}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => {
                const def = renderMap.get(col.id);
                const tip = def?.getTooltip?.(row);
                const cell = def?.render(row) ?? null;
                return (
                  <td
                    key={col.id}
                    className="p-3 align-middle text-foreground overflow-hidden"
                    style={{ width: col.width, maxWidth: col.width }}
                    onClick={onRowClick ? undefined : undefined}
                  >
                    {tip != null && tip !== "" ? (
                      <TruncateTooltip text={tip}>{cell}</TruncateTooltip>
                    ) : (
                      <div className="truncate">{cell}</div>
                    )}
                  </td>
                );
              })}
              {renderActions && (
                <td
                  className="p-3 align-middle text-right"
                  style={{ width: actionsWidth || 88 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {renderActions(row)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { ColumnResizeHandle, TruncateTooltip };
