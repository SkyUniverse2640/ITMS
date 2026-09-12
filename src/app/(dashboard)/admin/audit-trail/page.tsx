"use client";

import { Fragment, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import { Search, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";

interface AuditRow {
  _id: string;
  actorName: string;
  action: string;
  module: string;
  targetLabel: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  Create: "bg-green-600 text-white dark:bg-green-600 dark:text-white",
  Update: "bg-blue-600 text-white dark:bg-blue-600 dark:text-white",
  Delete: "bg-red-600 text-white dark:bg-red-600 dark:text-white",
};

export default function AuditTrailPage() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { load(); }, [page, moduleFilter, actionFilter]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (search) params.set("search", search);
    if (moduleFilter) params.set("module", moduleFilter);
    if (actionFilter) params.set("action", actionFilter);
    try {
      const res = await fetch(`/api/audit?${params}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
      }
    } catch {}
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Trail</h1>
        <p className="text-muted-foreground">{total} logged actions — compliance record</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }} className="flex flex-1 gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search actor or target..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Button type="submit" variant="secondary">Search</Button>
            </form>
            <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Module" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {["Ticket", "Asset", "User", "Task", "Purchase", "Settings"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {["Create", "Update", "Delete"].map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center h-48 items-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">No audit records</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Target</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <Fragment key={log._id}>
                    <TableRow className="cursor-pointer" onClick={() => setExpanded(expanded === log._id ? null : log._id)}>
                      <TableCell>
                        <ChevronDown className={`h-4 w-4 transition-transform ${expanded === log._id ? "rotate-180" : ""}`} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDateTime(log.createdAt)}</TableCell>
                      <TableCell className="font-medium">{log.actorName}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_COLORS[log.action] || ""}`}>{log.action}</span>
                      </TableCell>
                      <TableCell><Badge variant="outline">{log.module}</Badge></TableCell>
                      <TableCell className="max-w-[250px] truncate">{log.targetLabel}</TableCell>
                    </TableRow>
                    {expanded === log._id && (log.before || log.after) && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/30">
                          <div className="grid gap-4 md:grid-cols-2 p-2">
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">Before</p>
                              <pre className="text-xs bg-background p-3 rounded border overflow-auto max-h-40">{log.before ? JSON.stringify(log.before, null, 2) : "—"}</pre>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">After</p>
                              <pre className="text-xs bg-background p-3 rounded border overflow-auto max-h-40">{log.after ? JSON.stringify(log.after, null, 2) : "—"}</pre>
                            </div>
                          </div>
                          {log.ipAddress && <p className="text-xs text-muted-foreground px-2 pb-2">IP: {log.ipAddress}</p>}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /> Prev</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
