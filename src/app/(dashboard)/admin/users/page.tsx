"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Plus, Search, ChevronLeft, ChevronRight, Upload, Download, History, Sparkles, GripVertical, RotateCcw, Eye,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { RowSettingsMenu } from "@/components/ui/row-settings-menu";
import {
  canonicalizeUserRow,
  parseSpreadsheetFile,
} from "@/lib/parse-spreadsheet";
import { downloadImportTemplate } from "@/lib/download-template";
import { ImportOverlay } from "@/components/ui/import-overlay";
import { cn, formatDateTime } from "@/lib/utils";
import { ColumnResizeHandle, TruncateTooltip } from "@/components/ui/truncate-tooltip";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState } from "@/components/ui/loading-state";

interface User {
  _id: string;
  displayName: string;
  username: string;
  email: string;
  role: string;
  userTypes: string[];
  jobTitle?: string;
  department?: string;
  employeeId?: string;
  mobile?: string;
  status: string;
}

interface ImportHistoryRow {
  _id: string;
  fileName: string;
  importedByName: string;
  summary: { total: number; created: number; updated: number; failed: number };
  failures: { row: number; data?: Record<string, unknown>; error: string }[];
  createdAt: string;
}

type ColId =
  | "displayName"
  | "username"
  | "email"
  | "employeeId"
  | "department"
  | "jobTitle"
  | "mobile"
  | "role"
  | "userTypes"
  | "status";

interface ColumnDef {
  id: ColId;
  label: string;
  width: number;
  minWidth: number;
}

const ROLES = ["SuperAdmin", "User"];
const USER_TYPES = ["Requester", "Technician", "Approver", "Auditor"];

const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: "displayName", label: "Display Name", width: 160, minWidth: 100 },
  { id: "username", label: "Username", width: 120, minWidth: 90 },
  { id: "email", label: "Email", width: 200, minWidth: 120 },
  { id: "employeeId", label: "Employee ID", width: 120, minWidth: 90 },
  { id: "department", label: "Department", width: 120, minWidth: 90 },
  { id: "jobTitle", label: "Job Title", width: 130, minWidth: 90 },
  { id: "mobile", label: "Mobile", width: 120, minWidth: 90 },
  { id: "role", label: "Role", width: 110, minWidth: 80 },
  { id: "userTypes", label: "User Types", width: 160, minWidth: 100 },
  { id: "status", label: "Status", width: 100, minWidth: 80 },
];

const SEARCH_COLUMNS: { value: string; label: string }[] = [
  { value: "all", label: "All columns" },
  ...DEFAULT_COLUMNS.map((c) => ({ value: c.id, label: c.label })),
];

const COLS_STORAGE_KEY = "nexusdesk-users-table-columns";
const PAGE_SIZE_KEY = "nexusdesk-users-page-size";
const PAGE_SIZE_OPTIONS = [10, 25, 50, 75, 100] as const;

function loadPageSize(): number {
  if (typeof window === "undefined") return 25;
  try {
    const n = parseInt(localStorage.getItem(PAGE_SIZE_KEY) || "25", 10);
    return PAGE_SIZE_OPTIONS.includes(n as (typeof PAGE_SIZE_OPTIONS)[number]) ? n : 25;
  } catch {
    return 25;
  }
}

const emptyForm = {
  displayName: "",
  username: "",
  email: "",
  password: "",
  role: "User",
  userTypes: ["Requester"] as string[],
  jobTitle: "",
  department: "",
  employeeId: "",
  mobile: "",
  status: "Active",
};

function loadSavedColumns(): ColumnDef[] {
  if (typeof window === "undefined") return DEFAULT_COLUMNS.map((c) => ({ ...c }));
  try {
    const raw = localStorage.getItem(COLS_STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMNS.map((c) => ({ ...c }));
    const parsed = JSON.parse(raw) as { order?: string[]; widths?: Record<string, number> };
    const byId = new Map(DEFAULT_COLUMNS.map((c) => [c.id, { ...c }]));
    const order = Array.isArray(parsed.order)
      ? parsed.order.filter((id): id is ColId => byId.has(id as ColId))
      : DEFAULT_COLUMNS.map((c) => c.id);
    // Append any missing defaults
    for (const c of DEFAULT_COLUMNS) {
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
    return DEFAULT_COLUMNS.map((c) => ({ ...c }));
  }
}

function saveColumns(cols: ColumnDef[]) {
  try {
    localStorage.setItem(
      COLS_STORAGE_KEY,
      JSON.stringify({
        order: cols.map((c) => c.id),
        widths: Object.fromEntries(cols.map((c) => [c.id, c.width])),
      })
    );
  } catch {
    /* ignore */
  }
}

export default function UsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [searchColumn, setSearchColumn] = useState("all");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

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

  // Column order + widths
  const [columns, setColumns] = useState<ColumnDef[]>(() => DEFAULT_COLUMNS.map((c) => ({ ...c })));
  const dragColId = useRef<ColId | null>(null);
  const resizeRef = useRef<{ id: ColId; startX: number; startW: number } | null>(null);

  useEffect(() => {
    setColumns(loadSavedColumns());
    setPageSize(loadPageSize());
  }, []);

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  useEffect(() => {
    fetch("/api/settings?key=departments")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data)) {
          setDepartments(
            d.data
              .map((x: { name?: string } | string) =>
                typeof x === "string" ? x : x.name || ""
              )
              .filter(Boolean)
          );
        }
      })
      .catch(() => {});
  }, []);

  const persistColumns = useCallback((next: ColumnDef[]) => {
    setColumns(next);
    saveColumns(next);
  }, []);

  async function loadUsers(opts?: {
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
    try {
      const res = await fetch(`/api/users?${params}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    loadUsers({ page: 1, search, searchColumn, pageSize });
  }

  function handlePageSizeChange(value: string) {
    const n = parseInt(value, 10);
    if (!PAGE_SIZE_OPTIONS.includes(n as (typeof PAGE_SIZE_OPTIONS)[number])) return;
    setPageSize(n);
    setPage(1);
    try {
      localStorage.setItem(PAGE_SIZE_KEY, String(n));
    } catch {
      /* ignore */
    }
    // loadUsers runs via useEffect on pageSize change
  }

  function openNew() {
    setEditingUser(null);
    setForm({ ...emptyForm, department: departments[0] || "" });
    setDialogOpen(true);
  }

  function openEdit(u: User) {
    setEditingUser(u);
    setForm({
      displayName: u.displayName,
      username: u.username,
      email: u.email,
      password: "",
      role: u.role,
      userTypes: u.userTypes || ["Requester"],
      jobTitle: u.jobTitle || "",
      department: u.department || "",
      employeeId: u.employeeId || "",
      mobile: u.mobile || "",
      status: u.status,
    });
    setDialogOpen(true);
  }

  function toggleUserType(type: string) {
    setForm((prev) => {
      const has = prev.userTypes.includes(type);
      const next = has
        ? prev.userTypes.filter((t) => t !== type)
        : [...prev.userTypes, type];
      return { ...prev, userTypes: next.length ? next : prev.userTypes };
    });
  }

  async function handleSave() {
    if (!form.displayName || !form.username || !form.email || !form.employeeId) {
      toast({ title: "Missing required fields (name, username, email, employeeId)", variant: "destructive" });
      return;
    }
    if (!editingUser && !form.password) {
      toast({ title: "Password is required for new users", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { ...form };
      if (editingUser && !form.password) delete body.password;

      const url = editingUser ? `/api/users/${editingUser._id}` : "/api/users";
      const method = editingUser ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: editingUser ? "User updated" : "User created", variant: "success" });
        setDialogOpen(false);
        loadUsers();
      } else {
        toast({ title: data.error || "Failed to save user", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleDeactivate(u: User) {
    try {
      const res = await fetch(`/api/users/${u._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Inactive" }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "User deactivated", variant: "success" });
        loadUsers();
      } else {
        toast({ title: data.error || "Failed to deactivate", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
  }

  async function downloadTemplate() {
    try {
      await downloadImportTemplate("user");
    } catch {
      toast({ title: "Failed to download template", variant: "destructive" });
    }
  }

  async function generateRecommendation() {
    setImporting(true);
    try {
      const res = await fetch("/api/onboarding/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "users" }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: data.message || "Recommendations applied", variant: "success" });
        loadUsers();
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
      const usersPayload = rawRows.map((r) => canonicalizeUserRow(r));
      const res = await fetch("/api/users/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          users: usersPayload,
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
        toast({
          title: "Import finished",
          description: `${summary.created} created, ${summary.updated} updated, ${summary.failed} failed`,
          variant: summary.failed > 0 ? "destructive" : "success",
        });
        loadUsers();
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
      const res = await fetch("/api/users/import?limit=30");
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
      const res = await fetch(`/api/users/import?id=${id}`);
      const data = await res.json();
      if (data.success) setSelectedHistory(data.data);
    } catch {
      /* ignore */
    }
    setHistoryLoading(false);
  }

  // —— Column drag reorder ——
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

  // —— Column resize ——
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
        prev.map((c) => {
          if (c.id !== r.id) return c;
          return { ...c, width: Math.max(c.minWidth, r.startW + delta) };
        })
      );
    }

    function onUp() {
      resizeRef.current = null;
      setColumns((prev) => {
        saveColumns(prev);
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

  function cellTooltip(u: User, id: ColId): string {
    switch (id) {
      case "displayName":
        return u.displayName || "";
      case "username":
        return u.username || "";
      case "email":
        return u.email || "";
      case "employeeId":
        return u.employeeId || "";
      case "department":
        return u.department || "";
      case "jobTitle":
        return u.jobTitle || "";
      case "mobile":
        return u.mobile || "";
      case "role":
        return u.role || "";
      case "userTypes":
        return (u.userTypes || []).join(", ");
      case "status":
        return u.status || "";
      default:
        return "";
    }
  }

  function renderCell(u: User, id: ColId) {
    switch (id) {
      case "displayName":
        return <span className="font-medium">{u.displayName}</span>;
      case "username":
        return <span className="text-sm">{u.username}</span>;
      case "email":
        return <span className="text-sm">{u.email}</span>;
      case "employeeId":
        return <span className="text-sm font-mono">{u.employeeId || "—"}</span>;
      case "department":
        return <span className="text-sm">{u.department || "—"}</span>;
      case "jobTitle":
        return <span className="text-sm">{u.jobTitle || "—"}</span>;
      case "mobile":
        return <span className="text-sm">{u.mobile || "—"}</span>;
      case "role":
        return (
          <Badge variant={u.role === "SuperAdmin" ? "default" : "secondary"}>{u.role}</Badge>
        );
      case "userTypes":
        return (
          <div className="flex flex-wrap gap-1">
            {(u.userTypes || []).map((t) => (
              <Badge key={t} variant="outline" className="text-xs">
                {t}
              </Badge>
            ))}
          </div>
        );
      case "status":
        return (
          <Badge
            variant={u.status === "Active" ? "default" : "secondary"}
            className={
              u.status === "Active" ? "bg-green-600 text-white" : "bg-slate-500 text-white"
            }
          >
            {u.status}
          </Badge>
        );
      default:
        return null;
    }
  }

  const tableMinWidth =
    columns.reduce((s, c) => s + c.width, 0) + 88; /* actions */

  return (
    <div className="space-y-6">
      <ImportOverlay
        open={importing}
        kind="spreadsheet"
        label="Importing users…"
        detail={importFileName || undefined}
      />
      <div className="flex flex-col gap-3">
        <PageHeader
          title="Manage Users"
          description={`${total} total users`}
          actions={
            <>
              <Button variant="outline" size="sm" onClick={openHistory}>
                <History className="h-4 w-4 mr-2" /> Import History
              </Button>
              <Button size="sm" onClick={openNew}>
                <Plus className="h-4 w-4 mr-1" /> New User
              </Button>
            </>
          }
        />
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
              accept=".csv,.xlsx,.txt"
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

      {/* Search + filter by column */}
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
                    : `Search by ${SEARCH_COLUMNS.find((c) => c.value === searchColumn)?.label || "column"}...`
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="secondary" size="sm" className="h-10 sm:h-9">
              Search
            </Button>
            {/* View limit — rows per page */}
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
          <CardTitle className="text-lg">Users ({total})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <LoadingState label="Loading users" className="h-48" />
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p>No users found</p>
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
                          "relative h-12 px-3 text-left align-middle font-semibold text-foreground select-none",
                          "bg-background sticky top-0 z-[1]"
                        )}
                        style={{ width: col.width, minWidth: col.minWidth }}
                      >
                        <div className="flex items-center gap-1 pr-2">
                          <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground cursor-grab active:cursor-grabbing" />
                          <TruncateTooltip text={col.label} className="font-semibold">
                            {col.label}
                          </TruncateTooltip>
                        </div>
                        <ColumnResizeHandle onMouseDown={(e) => onResizeStart(e, col.id)} />
                      </th>
                    ))}
                    <th
                      className="h-12 px-3 text-right align-middle font-semibold text-foreground bg-background sticky top-0 z-[1]"
                      style={{ width: 88 }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u._id}
                      className="border-b transition-colors hover:bg-muted/50"
                    >
                      {columns.map((col) => (
                        <td
                          key={col.id}
                          className="p-3 align-middle text-foreground overflow-hidden"
                          style={{ width: col.width, maxWidth: col.width }}
                        >
                          <TruncateTooltip text={cellTooltip(u, col.id)}>
                            {renderCell(u, col.id)}
                          </TruncateTooltip>
                        </td>
                      ))}
                      <td className="p-3 align-middle text-right" style={{ width: 88 }}>
                        <RowSettingsMenu
                          objectName={u.displayName}
                          onEdit={() => openEdit(u)}
                          showDelete={u.status === "Active"}
                          deleteLabel="Deactivate"
                          actionVerb="deactivate"
                          onDelete={() => handleDeactivate(u)}
                        />
                      </td>
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

      {/* Create / Edit User */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "New User"}</DialogTitle>
            <DialogDescription>
              Fields match the user database schema. Department from Manage Department.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Display Name *</Label>
                <Input
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Username *</Label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Password {editingUser ? "(leave blank to keep)" : "*"}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>User Types</Label>
              <div className="flex flex-wrap gap-4 pt-1">
                {USER_TYPES.map((type) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.userTypes.includes(type)}
                      onCheckedChange={() => toggleUserType(type)}
                    />
                    <span className="text-sm">{type}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Job Title</Label>
                <Input
                  value={form.jobTitle}
                  onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={form.department || "none"}
                  onValueChange={(v) =>
                    setForm({ ...form, department: v === "none" ? "" : v })
                  }
                  disabled={departments.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        departments.length === 0
                          ? "Add departments in Manage Department first"
                          : "Select department"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {departments.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    No departments yet. Create or import under Users Management → Manage Department.
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Employee ID *</Label>
                <Input
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Mobile</Label>
                <Input
                  value={form.mobile}
                  onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingUser ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import result */}
      <Dialog open={importResultOpen} onOpenChange={setImportResultOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Result</DialogTitle>
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
                          {f.data ? JSON.stringify(f.data, null, 0) : "—"}
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

      {/* Import History */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Import History</DialogTitle>
            <DialogDescription>Past imports with failed-row details</DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <LoadingState label="Loading user import history" className="min-h-32 py-10" />
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
                        View Status
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
