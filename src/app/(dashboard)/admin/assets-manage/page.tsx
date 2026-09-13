"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Search, Upload, ChevronLeft, ChevronRight, Download, GripVertical, RotateCcw, Eye,
} from "lucide-react";
import { ASSET_STATE_COLORS, cn } from "@/lib/utils";
import { downloadImportTemplate } from "@/lib/download-template";
import { ImportOverlay } from "@/components/ui/import-overlay";
import { canonicalizeAssetRow, parseSpreadsheetFile } from "@/lib/parse-spreadsheet";
import { useToast } from "@/components/ui/toast";
import {
  type ColumnDef,
  PAGE_SIZE_OPTIONS,
  loadPageSize,
  loadSavedColumns,
  saveColumns,
  savePageSize,
} from "@/lib/table-prefs";
import { ColumnResizeHandle, TruncateTooltip } from "@/components/ui/truncate-tooltip";

interface AssetRow {
  _id: string;
  assetTag: string;
  name: string;
  assetCategory: string;
  assetType: string;
  currentState: string;
  serialNumber?: string;
  vendor?: string;
  assignedTo?: { displayName: string; department?: string };
  department?: string;
}

type ColId =
  | "assetTag"
  | "name"
  | "assetType"
  | "assetCategory"
  | "currentState"
  | "assignedTo"
  | "department"
  | "serialNumber"
  | "vendor";

const DEFAULT_COLUMNS: ColumnDef<ColId>[] = [
  { id: "assetTag", label: "Tag", width: 120, minWidth: 80 },
  { id: "name", label: "Name", width: 180, minWidth: 100 },
  { id: "assetType", label: "Product", width: 140, minWidth: 90 },
  { id: "assetCategory", label: "Category", width: 110, minWidth: 80 },
  { id: "currentState", label: "State", width: 120, minWidth: 90 },
  { id: "assignedTo", label: "Assigned To", width: 140, minWidth: 100 },
  { id: "department", label: "Department", width: 120, minWidth: 90 },
  { id: "serialNumber", label: "Serial", width: 120, minWidth: 80 },
  { id: "vendor", label: "Vendor", width: 110, minWidth: 80 },
];

const SEARCH_COLUMNS = [
  { value: "all", label: "All columns" },
  { value: "assetTag", label: "Tag" },
  { value: "name", label: "Name" },
  { value: "assetType", label: "Product" },
  { value: "assetCategory", label: "Category" },
  { value: "currentState", label: "State" },
  { value: "serialNumber", label: "Serial" },
  { value: "department", label: "Department" },
  { value: "vendor", label: "Vendor" },
];

const COLS_KEY = "nexusdesk-assets-table-columns";
const PAGE_KEY = "nexusdesk-assets-page-size";

export default function ManageAllAssetsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [search, setSearch] = useState("");
  const [searchColumn, setSearchColumn] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importFileName, setImportFileName] = useState<string>("");

  const [columns, setColumns] = useState<ColumnDef<ColId>[]>(() =>
    DEFAULT_COLUMNS.map((c) => ({ ...c }))
  );
  const dragColId = useRef<ColId | null>(null);
  const resizeRef = useRef<{ id: ColId; startX: number; startW: number } | null>(null);

  useEffect(() => {
    setColumns(loadSavedColumns(COLS_KEY, DEFAULT_COLUMNS));
    setPageSize(loadPageSize(PAGE_KEY, 25));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, categoryFilter, stateFilter]);

  const persistColumns = useCallback((next: ColumnDef<ColId>[]) => {
    setColumns(next);
    saveColumns(COLS_KEY, next);
  }, []);

  async function load(opts?: {
    page?: number;
    search?: string;
    searchColumn?: string;
    pageSize?: number;
  }) {
    setLoading(true);
    const p = opts?.page ?? page;
    const q = opts?.search ?? search;
    const col = opts?.searchColumn ?? searchColumn;
    const limit = opts?.pageSize ?? pageSize;
    const params = new URLSearchParams({ page: String(p), limit: String(limit) });
    if (q.trim()) {
      params.set("search", q.trim());
      if (col && col !== "all") params.set("searchColumn", col);
    }
    if (categoryFilter) params.set("category", categoryFilter);
    if (stateFilter) params.set("state", stateFilter);
    try {
      const res = await fetch(`/api/assets?${params}`);
      const data = await res.json();
      if (data.success) {
        setAssets(data.data);
        setTotalPages(data.pagination.totalPages || 1);
        setTotal(data.pagination.total || 0);
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load({ page: 1, search, searchColumn, pageSize });
  }

  function handlePageSizeChange(value: string) {
    const n = parseInt(value, 10);
    if (!PAGE_SIZE_OPTIONS.includes(n as (typeof PAGE_SIZE_OPTIONS)[number])) return;
    setPageSize(n);
    setPage(1);
    savePageSize(PAGE_KEY, n);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportFileName(file.name);
    setImporting(true);
    try {
      const rawRows = await parseSpreadsheetFile(file);
      if (rawRows.length === 0) {
        toast({ title: "No data rows found in file", variant: "destructive" });
        setImporting(false);
        return;
      }
      const payload = rawRows.map((r) => canonicalizeAssetRow(r));
      const res = await fetch("/api/assets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets: payload, fileName: file.name }),
      });
      const data = await res.json();
      if (data.success) {
        const s = data.data?.summary;
        toast({
          title: "Import complete",
          description: s
            ? `${s.created} created, ${s.updated} updated, ${s.failed} failed`
            : data.message || "Import finished",
          variant: s?.failed > 0 ? "destructive" : "success",
        });
        load();
      } else {
        toast({ title: data.error || "Import failed", variant: "destructive" });
      }
    } catch (err) {
      toast({
        title: "Import failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
    setImporting(false);
  }

  function onHeaderDragStart(id: ColId) {
    dragColId.current = id;
  }

  function onHeaderDragOver(e: React.DragEvent, overId: ColId) {
    e.preventDefault();
    const from = dragColId.current;
    if (!from || from === overId) return;
    const next = [...columns];
    const fi = next.findIndex((c) => c.id === from);
    const ti = next.findIndex((c) => c.id === overId);
    if (fi < 0 || ti < 0) return;
    const [item] = next.splice(fi, 1);
    next.splice(ti, 0, item);
    dragColId.current = overId;
    persistColumns(next);
  }

  function onHeaderDragEnd() {
    dragColId.current = null;
  }

  function onResizeStart(e: React.MouseEvent, id: ColId) {
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
        saveColumns(COLS_KEY, prev);
        return prev;
      });
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function resetColumns() {
    const next = DEFAULT_COLUMNS.map((c) => ({ ...c }));
    persistColumns(next);
    toast({ title: "Table columns reset", variant: "success" });
  }

  function cellTooltip(a: AssetRow, id: ColId): string {
    switch (id) {
      case "assetTag":
        return a.assetTag || "";
      case "name":
        return a.name || "";
      case "assetType":
        return a.assetType || "";
      case "assetCategory":
        return a.assetCategory || "";
      case "currentState":
        return a.currentState || "";
      case "assignedTo":
        return a.assignedTo?.displayName || "";
      case "department":
        return a.department || a.assignedTo?.department || "";
      case "serialNumber":
        return a.serialNumber || "";
      case "vendor":
        return a.vendor || "";
      default:
        return "";
    }
  }

  function renderCell(a: AssetRow, id: ColId) {
    switch (id) {
      case "assetTag":
        return <span className="font-mono text-sm">{a.assetTag}</span>;
      case "name":
        return <span className="font-medium">{a.name}</span>;
      case "assetType":
        return <span className="text-sm">{a.assetType}</span>;
      case "assetCategory":
        return <span className="text-sm">{a.assetCategory}</span>;
      case "currentState":
        return (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ASSET_STATE_COLORS[a.currentState] || ""}`}
          >
            {a.currentState}
          </span>
        );
      case "assignedTo":
        return <span className="text-sm">{a.assignedTo?.displayName || "—"}</span>;
      case "department":
        return (
          <span className="text-sm">{a.department || a.assignedTo?.department || "—"}</span>
        );
      case "serialNumber":
        return <span className="text-sm font-mono">{a.serialNumber || "—"}</span>;
      case "vendor":
        return <span className="text-sm">{a.vendor || "—"}</span>;
      default:
        return null;
    }
  }

  const tableMinWidth = columns.reduce((s, c) => s + c.width, 0);

  return (
    <div className="space-y-6">
      <ImportOverlay
        open={importing}
        kind="spreadsheet"
        label="Importing assets…"
        detail={importFileName || undefined}
      />
      {/* Header — top primary actions, bottom import tools (same as Users) */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Manage All Assets</h1>
            <p className="text-muted-foreground">{total} assets in inventory</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/assets/new">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> New Asset
              </Button>
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await downloadImportTemplate("asset");
              } catch {
                toast({ title: "Failed to download template", variant: "destructive" });
              }
            }}
          >
            <Download className="h-4 w-4 mr-2" /> Download Template
          </Button>
          <label className="inline-flex">
            <span className="inline-flex items-center justify-center gap-2 h-9 rounded-md border border-input bg-background px-3 text-sm font-medium cursor-pointer hover:bg-accent dark:hover:bg-accent">
              <Upload className="h-4 w-4" />
              {importing ? "Importing..." : "Import from CSV/XLSX"}
            </span>
            <input
              type="file"
              accept=".csv,.xlsx,.txt"
              className="hidden"
              onChange={handleImport}
              disabled={importing}
            />
          </label>
        </div>
      </div>

      {/* Search + column filter + view limit + category/state */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row flex-1 gap-2">
            <Select value={searchColumn} onValueChange={setSearchColumn}>
              <SelectTrigger className="w-full sm:w-[180px] shrink-0">
                <SelectValue placeholder="Filter column" />
              </SelectTrigger>
              <SelectContent>
                {SEARCH_COLUMNS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={
                  searchColumn === "all"
                    ? "Search all columns..."
                    : `Search by ${SEARCH_COLUMNS.find((c) => c.value === searchColumn)?.label}...`
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="secondary" size="sm" className="h-10 sm:h-9">
              Search
            </Button>
            <div className="flex items-center gap-1.5 shrink-0">
              <Eye className="h-4 w-4 text-muted-foreground" aria-hidden />
              <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                <SelectTrigger
                  className="h-10 sm:h-9 w-[7.25rem]"
                  title="Rows visible per page"
                  aria-label="Rows visible per page"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      View {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 sm:h-9"
              title="Reset column order & widths"
              onClick={resetColumns}
            >
              <RotateCcw className="h-4 w-4 mr-1" /> Reset columns
            </Button>
          </form>
          <div className="flex flex-wrap gap-2">
            <Select
              value={categoryFilter || "all"}
              onValueChange={(v) => {
                setCategoryFilter(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Hardware">Hardware</SelectItem>
                <SelectItem value="Software">Software</SelectItem>
                <SelectItem value="Consumable">Consumable</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={stateFilter || "all"}
              onValueChange={(v) => {
                setStateFilter(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {["In Use", "In Warehouse", "In Repair", "Broken", "Disposed"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Drag column headers to reorder · drag the edge of a header to resize · filter search by
            column
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Assets ({total})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p>No assets found</p>
            </div>
          ) : (
            <div className="relative w-full overflow-auto">
              <table
                className="caption-bottom text-sm border-collapse"
                style={{ tableLayout: "fixed", width: tableMinWidth, minWidth: "100%" }}
              >
                <thead>
                  <tr className="border-b">
                    {columns.map((col) => (
                      <th
                        key={col.id}
                        draggable
                        onDragStart={() => onHeaderDragStart(col.id)}
                        onDragOver={(e) => onHeaderDragOver(e, col.id)}
                        onDragEnd={onHeaderDragEnd}
                        className={cn(
                          "relative h-12 px-3 text-left align-middle font-bold text-foreground select-none",
                          "bg-background sticky top-0 z-[1]"
                        )}
                        style={{ width: col.width, minWidth: col.minWidth }}
                      >
                        <div className="flex items-center gap-1 pr-2">
                          <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground cursor-grab active:cursor-grabbing" />
                          <TruncateTooltip text={col.label} className="font-bold">
                            {col.label}
                          </TruncateTooltip>
                        </div>
                        <ColumnResizeHandle onMouseDown={(e) => onResizeStart(e, col.id)} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
                    <tr
                      key={a._id}
                      className="border-b transition-colors cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/40"
                      onClick={() => router.push(`/assets/${a._id}`)}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.id}
                          className="p-3 align-middle text-foreground overflow-hidden"
                          style={{ width: col.width, maxWidth: col.width }}
                        >
                          <TruncateTooltip text={cellTooltip(a, col.id)}>
                            {renderCell(a, col.id)}
                          </TruncateTooltip>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {(totalPages > 1 || total > 0) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Page {page} of {Math.max(1, totalPages)} · showing up to {pageSize} rows
            {total > 0 ? ` · ${total} total` : ""}
          </p>
          {totalPages > 1 && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
