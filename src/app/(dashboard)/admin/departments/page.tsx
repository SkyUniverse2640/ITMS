"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Upload, Download, History, Sparkles, Search, ChevronLeft, ChevronRight,
  GripVertical, RotateCcw, Eye, ChevronDown, ChevronRight as ChevronRightIcon, Users,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { RowSettingsMenu } from "@/components/ui/row-settings-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  canonicalizeDeptRow,
  parseSpreadsheetFile,
} from "@/lib/parse-spreadsheet";
import { downloadImportTemplate } from "@/lib/download-template";
import { ImportOverlay } from "@/components/ui/import-overlay";
import { cn, formatDateTime } from "@/lib/utils";
import {
  type ColumnDef,
  PAGE_SIZE_OPTIONS,
  loadPageSize,
  loadSavedColumns,
  saveColumns,
  savePageSize,
} from "@/lib/table-prefs";
import { ColumnResizeHandle, TruncateTooltip } from "@/components/ui/truncate-tooltip";
import {
  DEPT_ROLE_LABELS,
  emptyRoles,
  normalizeDepartment,
  type DeptRoleLabel,
  type DepartmentRoles,
} from "@/lib/department-roles";

interface Department {
  id: string;
  name: string;
  description?: string;
  roles?: DepartmentRoles;
}

interface UserOption {
  _id: string;
  displayName: string;
  email: string;
  department?: string;
}

interface ImportHistoryRow {
  _id: string;
  fileName: string;
  importedByName: string;
  summary: { total: number; created: number; updated: number; failed: number };
  failures: { row: number; data?: Record<string, unknown>; error: string }[];
  createdAt: string;
}

type ColId = "name" | "description";

const DEFAULT_COLUMNS: ColumnDef<ColId>[] = [
  { id: "name", label: "Name", width: 200, minWidth: 100 },
  { id: "description", label: "Description", width: 360, minWidth: 140 },
];

const SEARCH_COLUMNS = [
  { value: "all", label: "All columns" },
  { value: "name", label: "Name" },
  { value: "description", label: "Description" },
];

const COLS_KEY = "nexusdesk-depts-table-columns";
const PAGE_KEY = "nexusdesk-depts-page-size";

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function DepartmentsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [searchColumn, setSearchColumn] = useState("all");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedColumn, setAppliedColumn] = useState("all");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const [importing, setImporting] = useState(false);
  const [importFileName, setImportFileName] = useState<string>("");
  const [importResultOpen, setImportResultOpen] = useState(false);
  const [lastImport, setLastImport] = useState<{
    summary: { total: number; created: number; updated: number; failed: number };
    failures: { row: number; data?: Record<string, unknown>; error: string }[];
    fileName: string;
  } | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [histories, setHistories] = useState<ImportHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<ImportHistoryRow | null>(null);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [roleDialog, setRoleDialog] = useState<{
    deptId: string;
    label: DeptRoleLabel;
  } | null>(null);
  const [rolePick, setRolePick] = useState<string[]>([]);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleSearch, setRoleSearch] = useState("");
  const [roleSearchApplied, setRoleSearchApplied] = useState("");

  const [columns, setColumns] = useState<ColumnDef<ColId>[]>(() =>
    DEFAULT_COLUMNS.map((c) => ({ ...c }))
  );
  const dragColId = useRef<ColId | null>(null);
  const resizeRef = useRef<{ id: ColId; startX: number; startW: number } | null>(null);

  useEffect(() => {
    setColumns(loadSavedColumns(COLS_KEY, DEFAULT_COLUMNS));
    setPageSize(loadPageSize(PAGE_KEY, 25));
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const deptRes = await fetch("/api/settings?key=departments");
      const data = await deptRes.json();
      if (data.success && Array.isArray(data.data)) {
        setItems(data.data.map((x: unknown, i: number) => normalizeDepartment(x, i)));
      } else {
        setItems([]);
      }

      // Load ALL users (paginated) so department-scoped role pickers see everyone,
      // not just the first page (was capped at 100 → missed members).
      const collected: UserOption[] = [];
      const limit = 100;
      let page = 1;
      let totalPages = 1;
      do {
        const uRes = await fetch(`/api/users?limit=${limit}&page=${page}`);
        const uData = await uRes.json();
        if (!uData.success || !Array.isArray(uData.data)) break;
        for (const u of uData.data as UserOption[]) {
          collected.push({
            _id: u._id,
            displayName: u.displayName,
            email: u.email,
            department: u.department,
          });
        }
        totalPages = uData.pagination?.totalPages || 1;
        page += 1;
      } while (page <= totalPages && page <= 100);
      setAllUsers(collected);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openRoleEditor(deptId: string, label: DeptRoleLabel) {
    const dept = items.find((d) => d.id === deptId);
    setRoleDialog({ deptId, label });
    setRolePick([...(dept?.roles?.[label] || [])]);
    setRoleSearch("");
    setRoleSearchApplied("");
  }

  const roleUsersFiltered = useMemo(() => {
    // Only people who belong to THIS department (case/space-insensitive exact name).
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const deptName = roleDialog
      ? norm(items.find((d) => d.id === roleDialog.deptId)?.name || "")
      : "";
    let base = allUsers;
    if (deptName) {
      base = allUsers.filter((u) => norm(u.department || "") === deptName);
    }
    const q = roleSearchApplied.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (u) =>
        (u.displayName || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.department || "").toLowerCase().includes(q)
    );
  }, [allUsers, roleSearchApplied, roleDialog, items]);

  function toggleRoleUser(userId: string) {
    setRolePick((prev) =>
      prev.includes(userId) ? prev.filter((x) => x !== userId) : [...prev, userId]
    );
  }

  async function saveRoleMembers() {
    if (!roleDialog) return;
    setRoleSaving(true);
    const next = items.map((d) => {
      if (d.id !== roleDialog.deptId) return d;
      const roles = { ...(d.roles || emptyRoles()) };
      roles[roleDialog.label] = [...rolePick];
      return { ...d, roles };
    });
    if (await saveList(next)) {
      setItems(next);
      setRoleDialog(null);
      toast({
        title: `${roleDialog.label} updated`,
        description: `${rolePick.length} member(s) assigned`,
        variant: "success",
      });
    } else {
      toast({ title: "Failed to save", variant: "destructive" });
    }
    setRoleSaving(false);
  }

  function userName(id: string) {
    return allUsers.find((u) => u._id === id)?.displayName || id.slice(-6);
  }

  const filtered = useMemo(() => {
    const q = appliedSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((d) => {
      const name = (d.name || "").toLowerCase();
      const desc = (d.description || "").toLowerCase();
      if (appliedColumn === "name") return name.includes(q);
      if (appliedColumn === "description") return desc.includes(q);
      return name.includes(q) || desc.includes(q);
    });
  }, [items, appliedSearch, appliedColumn]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const persistColumns = useCallback((next: ColumnDef<ColId>[]) => {
    setColumns(next);
    saveColumns(COLS_KEY, next);
  }, []);

  async function saveList(next: Department[]) {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "departments", value: next }),
    });
    return (await res.json()).success;
  }

  function openNew() {
    setEditing(null);
    setForm({ name: "", description: "" });
    setDialogOpen(true);
  }

  function openEdit(d: Department) {
    setEditing(d);
    setForm({ name: d.name, description: d.description || "" });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    const name = form.name.trim();
    const dup = items.some(
      (d) => d.name.toLowerCase() === name.toLowerCase() && d.id !== editing?.id
    );
    if (dup) {
      toast({ title: "Department name already exists", variant: "destructive" });
      return;
    }
    setSaving(true);
    let next: Department[];
    if (editing) {
      next = items.map((d) =>
        d.id === editing.id ? { ...d, name, description: form.description } : d
      );
    } else {
      next = [
        ...items,
        { id: genId(), name, description: form.description, roles: emptyRoles() },
      ];
    }
    if (await saveList(next)) {
      setItems(next);
      setDialogOpen(false);
      toast({ title: editing ? "Department updated" : "Department created", variant: "success" });
    } else {
      toast({ title: "Failed to save", variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleDelete(d: Department) {
    const next = items.filter((x) => x.id !== d.id);
    if (await saveList(next)) {
      setItems(next);
      toast({ title: "Deleted", variant: "success" });
    } else {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  }

  async function downloadTemplate() {
    try {
      await downloadImportTemplate("department");
    } catch {
      toast({ title: "Failed to download template", variant: "destructive" });
    }
  }

  async function generateRecommendation() {
    setImportFileName("");
    setImporting(true);
    try {
      const res = await fetch("/api/onboarding/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "departments" }),
      });
      const data = await res.json();
      if (data.success) {
        if (Array.isArray(data.data?.departments)) {
          setItems(
            data.data.departments.map((x: Department, i: number) => ({
              id: x.id || `dept-${i}`,
              name: x.name,
              description: x.description || "",
            }))
          );
        } else {
          load();
        }
        toast({ title: data.message || "Recommendations applied", variant: "success" });
      } else {
        toast({ title: data.error || "Failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to generate recommendations", variant: "destructive" });
    }
    setImporting(false);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
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
      const payload = rawRows.map((r) => canonicalizeDeptRow(r));
      const res = await fetch("/api/departments/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departments: payload,
          fileName: file.name,
          updateExisting: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const summary = data.data.summary;
        setLastImport({
          summary,
          failures: data.data.failures || [],
          fileName: file.name,
        });
        setImportResultOpen(true);
        if (Array.isArray(data.data.departments)) {
          setItems(
            data.data.departments.map((x: Department, i: number) => ({
              id: x.id || `dept-${i}`,
              name: x.name,
              description: x.description || "",
            }))
          );
        } else {
          load();
        }
        toast({
          title: "Import finished",
          description: `${summary.created} created, ${summary.updated} updated, ${summary.failed} failed`,
          variant: summary.failed > 0 ? "destructive" : "success",
        });
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

  async function openHistory() {
    setHistoryOpen(true);
    setSelectedHistory(null);
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/departments/import?limit=30");
      const data = await res.json();
      if (data.success) setHistories(data.data || []);
    } catch {
      /* ignore */
    }
    setHistoryLoading(false);
  }

  async function viewHistoryDetail(id: string) {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/departments/import?id=${id}`);
      const data = await res.json();
      if (data.success) setSelectedHistory(data.data);
    } catch {
      /* ignore */
    }
    setHistoryLoading(false);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setAppliedSearch(search);
    setAppliedColumn(searchColumn);
    setPage(1);
  }

  function handlePageSizeChange(value: string) {
    const n = parseInt(value, 10);
    if (!PAGE_SIZE_OPTIONS.includes(n as (typeof PAGE_SIZE_OPTIONS)[number])) return;
    setPageSize(n);
    setPage(1);
    savePageSize(PAGE_KEY, n);
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

  function cellTooltip(d: Department, id: ColId) {
    if (id === "name") return d.name || "";
    return d.description || "";
  }

  function renderCell(d: Department, id: ColId) {
    if (id === "name") return <span className="font-medium">{d.name}</span>;
    return <span className="text-sm text-muted-foreground">{d.description || "—"}</span>;
  }

  const tableMinWidth = columns.reduce((s, c) => s + c.width, 0) + 88;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ImportOverlay
        open={importing}
        kind="spreadsheet"
        label="Importing departments…"
        detail={importFileName || undefined}
      />
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Manage Department</h1>
            <p className="text-muted-foreground">
              Departments for users (dropdown + import validation).
              <br />
              {total} shown{appliedSearch ? " (filtered)" : ""}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={openHistory}>
              <History className="h-4 w-4 mr-2" /> Import History
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> New Department
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" /> Download Template
          </Button>
          <label className="inline-flex">
            <span className="inline-flex items-center justify-center gap-2 h-9 rounded-md border border-input bg-background px-3 text-sm font-medium cursor-pointer hover:bg-accent dark:hover:bg-accent">
              <Upload className="h-4 w-4" />
              {importing ? "Importing..." : "Import from CSV/XLSX"}
            </span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.txt"
              className="hidden"
              onChange={handleImportFile}
              disabled={importing}
            />
          </label>
          <Button variant="secondary" size="sm" onClick={generateRecommendation} disabled={importing}>
            <Sparkles className="h-4 w-4 mr-2" /> Generate Recommendation
          </Button>
        </div>
      </div>

      {/* Search + column filter + view limit */}
      <Card>
        <CardContent className="p-4">
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
          <p className="text-xs text-muted-foreground mt-2">
            Drag column headers to reorder · drag the edge of a header to resize · filter search by
            column
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Departments ({total})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {pageItems.length === 0 ? (
            <p className="text-muted-foreground text-center py-10 text-sm">
              No departments yet. Create one or import CSV/XLSX.
            </p>
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
                    <th
                      className="h-12 px-3 text-right align-middle font-bold text-foreground bg-background sticky top-0 z-[1]"
                      style={{ width: 88 }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((d) => {
                    const isOpen = expanded.has(d.id);
                    const roles = d.roles || emptyRoles();
                    const colSpan = columns.length + 1;
                    return (
                      <Fragment key={d.id}>
                        <tr className="border-b transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/40">
                          {columns.map((col, colIdx) => (
                            <td
                              key={col.id}
                              className="p-3 align-middle text-foreground overflow-hidden"
                              style={{ width: col.width, maxWidth: col.width }}
                            >
                              {colIdx === 0 ? (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <button
                                    type="button"
                                    className="shrink-0 p-0.5 rounded hover:bg-accent"
                                    onClick={() => toggleExpand(d.id)}
                                    aria-label={isOpen ? "Collapse" : "Expand"}
                                  >
                                    {isOpen ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRightIcon className="h-4 w-4" />
                                    )}
                                  </button>
                                  <TruncateTooltip text={cellTooltip(d, col.id)}>
                                    {renderCell(d, col.id)}
                                  </TruncateTooltip>
                                </div>
                              ) : (
                                <TruncateTooltip text={cellTooltip(d, col.id)}>
                                  {renderCell(d, col.id)}
                                </TruncateTooltip>
                              )}
                            </td>
                          ))}
                          <td className="p-3 align-middle text-right" style={{ width: 88 }}>
                            <RowSettingsMenu
                              objectName={d.name}
                              onEdit={() => openEdit(d)}
                              onDelete={() => handleDelete(d)}
                            />
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-b bg-muted/20">
                            <td colSpan={colSpan} className="p-4">
                              <p className="text-xs text-muted-foreground mb-3">
                                Hierarchy for SLA breach notify & ticket approval — SuperAdmin
                                assigns people per label.
                              </p>
                              <div className="grid gap-3 sm:grid-cols-3">
                                {DEPT_ROLE_LABELS.map((label) => {
                                  const members = roles[label] || [];
                                  return (
                                    <div
                                      key={label}
                                      className="rounded-lg border bg-background p-3 space-y-2"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-semibold flex items-center gap-1.5">
                                          <Users className="h-3.5 w-3.5 text-primary" />
                                          {label}
                                        </span>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs"
                                          onClick={() => openRoleEditor(d.id, label)}
                                        >
                                          Edit
                                        </Button>
                                      </div>
                                      {members.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">No members</p>
                                      ) : (
                                        <ul className="space-y-1">
                                          {members.map((uid) => (
                                            <li
                                              key={uid}
                                              className="text-xs font-medium truncate"
                                              title={userName(uid)}
                                            >
                                              {userName(uid)}
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                      <p className="text-[10px] text-muted-foreground">
                                        {members.length} person{members.length === 1 ? "" : "s"}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {(totalPages > 1 || total > 0) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Page {safePage} of {totalPages} · showing up to {pageSize} rows
            {total > 0 ? ` · ${total} total` : ""}
          </p>
          {totalPages > 1 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Department" : "New Department"}</DialogTitle>
            <DialogDescription>
              Name is unique. Used in Manage Users dropdown and user import validation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. IT"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importResultOpen} onOpenChange={setImportResultOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Department Import Result</DialogTitle>
            <DialogDescription>
              {lastImport?.fileName} —{" "}
              {lastImport
                ? `${lastImport.summary.created} created, ${lastImport.summary.updated} updated, ${lastImport.summary.failed} failed of ${lastImport.summary.total}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {lastImport && lastImport.failures.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-red-600">
                Failed rows ({lastImport.failures.length})
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Row #</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lastImport.failures.map((f) => (
                    <TableRow key={`fail-${f.row}-${f.error}`}>
                      <TableCell className="font-mono font-semibold">{f.row}</TableCell>
                      <TableCell className="text-xs max-w-[240px]">
                        <pre className="whitespace-pre-wrap break-all">
                          {f.data ? JSON.stringify(f.data) : "—"}
                        </pre>
                      </TableCell>
                      <TableCell className="text-sm text-red-600 dark:text-red-400">
                        {f.error}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">All rows imported successfully.</p>
          )}
          <DialogFooter>
            <Button onClick={() => setImportResultOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Department Import History</DialogTitle>
            <DialogDescription>Past imports with failed-row details</DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : selectedHistory ? (
            <div className="space-y-4">
              <Button variant="outline" size="sm" onClick={() => setSelectedHistory(null)}>
                ← Back to list
              </Button>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{selectedHistory.fileName}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {selectedHistory.importedByName} · {formatDateTime(selectedHistory.createdAt)} ·{" "}
                    {selectedHistory.summary.created} created, {selectedHistory.summary.updated}{" "}
                    updated, {selectedHistory.summary.failed} failed / {selectedHistory.summary.total}{" "}
                    total
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  {selectedHistory.failures?.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">Row #</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedHistory.failures.map((f, i) => (
                          <TableRow key={`${selectedHistory._id}-f-${f.row}-${i}`}>
                            <TableCell className="font-mono font-semibold">{f.row}</TableCell>
                            <TableCell className="text-xs max-w-[280px]">
                              <pre className="whitespace-pre-wrap break-all">
                                {f.data ? JSON.stringify(f.data) : "—"}
                              </pre>
                            </TableCell>
                            <TableCell className="text-sm text-red-600 dark:text-red-400">
                              {f.error}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground p-4">No failed rows.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : histories.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No import history yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead className="text-right">Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {histories.map((h) => (
                  <TableRow key={h._id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDateTime(h.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{h.fileName}</TableCell>
                    <TableCell className="text-sm">{h.importedByName}</TableCell>
                    <TableCell className="text-sm">
                      +{h.summary.created} / ~{h.summary.updated} / ✗{h.summary.failed} of{" "}
                      {h.summary.total}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => viewHistoryDetail(h._id)}>
                        View failures
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Director / Manager / Supervisor */}
      <Dialog
        open={!!roleDialog}
        onOpenChange={(o) => {
          if (!o) {
            setRoleDialog(null);
            setRoleSearch("");
            setRoleSearchApplied("");
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Assign {roleDialog?.label}
              {roleDialog
                ? ` — ${items.find((x) => x.id === roleDialog.deptId)?.name || ""}`
                : ""}
            </DialogTitle>
            <DialogDescription>
              Select people for this department label. Used for SLA breach notifications and ticket
              approval.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 py-1">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search name, email, department..."
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setRoleSearchApplied(roleSearch);
                  }
                }}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRoleSearchApplied(roleSearch)}
            >
              <Search className="h-4 w-4 mr-1" />
              Search
            </Button>
          </div>
          {rolePick.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {rolePick.length} selected · showing {roleUsersFiltered.length} in this department
            </p>
          )}
          <div className="space-y-2 py-2 max-h-[50vh] overflow-y-auto">
            {roleUsersFiltered.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {roleSearchApplied.trim()
                  ? `No users match "${roleSearchApplied}" in this department.`
                  : "No users belong to this department yet. Assign people to it in Manage Users first."}
              </p>
            ) : (
              roleUsersFiltered.map((u) => (
                <label
                  key={u._id}
                  className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-accent/40"
                >
                  <Checkbox
                    checked={rolePick.includes(u._id)}
                    onCheckedChange={() => toggleRoleUser(u._id)}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {u.email}
                      {u.department ? ` · ${u.department}` : ""}
                    </p>
                  </div>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialog(null)} disabled={roleSaving}>
              Cancel
            </Button>
            <Button onClick={saveRoleMembers} disabled={roleSaving}>
              {roleSaving ? "Saving..." : `Save (${rolePick.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
