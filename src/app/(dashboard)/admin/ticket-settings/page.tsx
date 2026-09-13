"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Clock } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { notifyTicketMetaChanged } from "@/components/providers/ticket-meta-provider";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState } from "@/components/ui/loading-state";
import { RowSettingsMenu } from "@/components/ui/row-settings-menu";
import {
  needsStatusMigration,
  systemStatusesForSettings,
} from "@/lib/ticket-status";

interface SimpleItem {
  id: string;
  name: string;
  description?: string;
  ticketCode?: string;
}

interface StatusItem extends SimpleItem {
  timerStop: boolean;
  color: string;
}

interface PriorityItem extends SimpleItem {
  color: string;
  respondTime?: number;
  resolveTime?: number;
}

type PriorityMatrix = Record<string, Record<string, string>>;

type TimeUnit = "minutes" | "hours" | "days";

const DEFAULT_PRIORITY_MATRIX: PriorityMatrix = {
  "Very Low": { "Very Low": "Very Low", Low: "Very Low", Normal: "Low", High: "Low", "Very High": "Normal" },
  Low: { "Very Low": "Very Low", Low: "Low", Normal: "Low", High: "Normal", "Very High": "High" },
  Normal: { "Very Low": "Low", Low: "Low", Normal: "Normal", High: "High", "Very High": "High" },
  High: { "Very Low": "Low", Low: "Normal", Normal: "High", High: "High", "Very High": "Very High" },
  "Very High": { "Very Low": "Normal", Low: "High", Normal: "High", High: "Very High", "Very High": "Very High" },
};

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function withIds<T extends { id?: string; name?: string }>(items: T[]): (T & { id: string })[] {
  if (!Array.isArray(items)) return [];
  const used = new Set<string>();
  return items.map((item, index) => {
    let id = item.id || (item.name ? `seed-${item.name}` : `item-${index}`);
    if (used.has(id)) id = `${id}-${index}`;
    used.add(id);
    return { ...item, id };
  });
}

function toDisplayTime(minutes: number): { value: number; unit: TimeUnit } {
  if (!minutes || minutes <= 0) return { value: 0, unit: "minutes" };
  if (minutes % 1440 === 0) return { value: minutes / 1440, unit: "days" };
  if (minutes % 60 === 0) return { value: minutes / 60, unit: "hours" };
  return { value: minutes, unit: "minutes" };
}

function toMinutes(value: number, unit: TimeUnit): number {
  if (unit === "days") return value * 1440;
  if (unit === "hours") return value * 60;
  return value;
}

function formatDuration(mins: number): string {
  if (!mins || mins <= 0) return "—";
  if (mins % 1440 === 0) { const d = mins / 1440; return `${d} day${d > 1 ? "s" : ""}`; }
  if (mins % 60 === 0) { const h = mins / 60; return `${h} hour${h > 1 ? "s" : ""}`; }
  return `${mins} min`;
}

export default function TicketSettingsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState("statuses");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [impacts, setImpacts] = useState<SimpleItem[]>([]);
  const [urgencies, setUrgencies] = useState<SimpleItem[]>([]);
  const [priorities, setPriorities] = useState<PriorityItem[]>([]);
  const [priorityMatrix, setPriorityMatrix] = useState<PriorityMatrix>(DEFAULT_PRIORITY_MATRIX);
  const [matrixSaving, setMatrixSaving] = useState(false);
  const [requestTypes, setRequestTypes] = useState<SimpleItem[]>([]);
  const [closureCodes, setClosureCodes] = useState<SimpleItem[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKind, setDialogKind] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    timerStop: false,
    color: "#3b82f6",
    ticketCode: "",
  });

  // SLA editing state
  const [slaSaving, setSlaSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadSetting(key: string) {
    try {
      const res = await fetch(`/api/settings?key=${key}`);
      const data = await res.json();
      if (data.success && data.data != null) return data.data;
    } catch {}
    return null;
  }

  async function saveSetting(key: string, value: unknown) {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    const ok = (await res.json()).success;
    if (ok && (key === "ticketStatuses" || key === "priorities")) {
      notifyTicketMetaChanged();
    }
    return ok;
  }

  function normalizeSimple(raw: unknown): SimpleItem[] {
    if (!Array.isArray(raw)) return [];
    return withIds(
      raw.map((x) =>
        typeof x === "string"
          ? { name: x, description: "", ticketCode: "" }
          : {
              id: (x as SimpleItem).id,
              name: (x as SimpleItem).name,
              description: (x as SimpleItem).description,
              ticketCode: (x as SimpleItem).ticketCode || "",
            }
      )
    );
  }

  function normalizeTicketCodeInput(raw: string): string {
    return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  }

  async function loadAll() {
    setLoading(true);
    const [s, i, u, p, rt, cc, matrix] = await Promise.all([
      loadSetting("ticketStatuses"),
      loadSetting("impacts"),
      loadSetting("urgencies"),
      loadSetting("priorities"),
      loadSetting("requestTypes"),
      loadSetting("closureCodes"),
      loadSetting("priorityMatrix"),
    ]);
    if (needsStatusMigration(s)) {
      const next = systemStatusesForSettings() as StatusItem[];
      await saveSetting("ticketStatuses", next);
      setStatuses(next);
    } else if (s) {
      setStatuses(withIds(s as StatusItem[]) as StatusItem[]);
    } else {
      setStatuses(systemStatusesForSettings() as StatusItem[]);
    }
    if (i) setImpacts(normalizeSimple(i));
    if (u) setUrgencies(normalizeSimple(u));
    if (p) setPriorities(withIds(p as PriorityItem[]) as PriorityItem[]);
    if (rt) setRequestTypes(normalizeSimple(rt));
    if (cc) setClosureCodes(normalizeSimple(cc));
    if (matrix && typeof matrix === "object" && !Array.isArray(matrix)) {
      setPriorityMatrix(matrix as PriorityMatrix);
    } else {
      setPriorityMatrix(DEFAULT_PRIORITY_MATRIX);
    }
    setLoading(false);
  }

  const keyMap: Record<string, string> = {
    statuses: "ticketStatuses",
    requestTypes: "requestTypes",
    closureCodes: "closureCodes",
  };

  function openNew(kind: string) {
    setDialogKind(kind);
    setEditingId(null);
    setForm({ name: "", description: "", timerStop: false, color: "#3b82f6", ticketCode: "" });
    setDialogOpen(true);
  }

  function openEdit(kind: string, item: SimpleItem | StatusItem) {
    setDialogKind(kind);
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description || "",
      timerStop: "timerStop" in item ? !!(item as StatusItem).timerStop : false,
      color: "color" in item ? (item as StatusItem).color || "#3b82f6" : "#3b82f6",
      ticketCode: "ticketCode" in item ? String((item as SimpleItem).ticketCode || "") : "",
    });
    setDialogOpen(true);
  }

  async function saveMatrixCell(impactName: string, urgencyName: string, priorityName: string) {
    const next: PriorityMatrix = {
      ...priorityMatrix,
      [impactName]: { ...(priorityMatrix[impactName] || {}), [urgencyName]: priorityName },
    };
    setPriorityMatrix(next);
    setMatrixSaving(true);
    const ok = await saveSetting("priorityMatrix", next);
    setMatrixSaving(false);
    if (!ok) toast({ title: "Failed to save matrix", variant: "destructive" });
  }

  async function resetMatrixDefaults() {
    setMatrixSaving(true);
    const ok = await saveSetting("priorityMatrix", DEFAULT_PRIORITY_MATRIX);
    setMatrixSaving(false);
    if (ok) {
      setPriorityMatrix(DEFAULT_PRIORITY_MATRIX);
      toast({ title: "Priority matrix reset to defaults", variant: "success" });
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    if (dialogKind === "requestTypes") {
      const code = normalizeTicketCodeInput(form.ticketCode);
      if (code.length < 2) {
        toast({ title: "Kode ID Ticket required", description: "Min. 2 characters (A–Z, 0–9)", variant: "destructive" });
        return;
      }
      const dup = requestTypes.some((rt) => rt.id !== editingId && normalizeTicketCodeInput(rt.ticketCode || "") === code);
      if (dup) { toast({ title: "Kode ID Ticket already used", variant: "destructive" }); return; }
    }
    setSaving(true);
    const key = keyMap[dialogKind];
    let list: unknown[] = [];
    if (dialogKind === "statuses") list = [...statuses];
    else if (dialogKind === "requestTypes") list = [...requestTypes];
    else if (dialogKind === "closureCodes") list = [...closureCodes];

    const ticketCode = normalizeTicketCodeInput(form.ticketCode);
    if (editingId) {
      list = (list as SimpleItem[]).map((item) => {
        if (item.id !== editingId) return item;
        if (dialogKind === "statuses") return { ...item, name: form.name, description: form.description, timerStop: form.timerStop, color: form.color };
        if (dialogKind === "requestTypes") return { ...item, name: form.name, description: form.description, ticketCode };
        return { ...item, name: form.name, description: form.description };
      });
    } else {
      const base = { id: genId(), name: form.name.trim(), description: form.description };
      if (dialogKind === "statuses") list = [...list, { ...base, timerStop: form.timerStop, color: form.color }];
      else if (dialogKind === "requestTypes") list = [...list, { ...base, ticketCode }];
      else list = [...list, base];
    }

    if (await saveSetting(key, list)) {
      if (dialogKind === "statuses") setStatuses(list as StatusItem[]);
      if (dialogKind === "requestTypes") setRequestTypes(list as SimpleItem[]);
      if (dialogKind === "closureCodes") setClosureCodes(list as SimpleItem[]);
      setDialogOpen(false);
      toast({ title: editingId ? "Updated" : "Created", variant: "success" });
    } else toast({ title: "Failed to save", variant: "destructive" });
    setSaving(false);
  }

  async function handleDelete(kind: string, id: string) {
    const key = keyMap[kind];
    let list: SimpleItem[] = [];
    if (kind === "statuses") list = statuses.filter((x) => x.id !== id) as SimpleItem[];
    if (kind === "requestTypes") list = requestTypes.filter((x) => x.id !== id);
    if (kind === "closureCodes") list = closureCodes.filter((x) => x.id !== id);
    if (await saveSetting(key, list)) {
      if (kind === "statuses") setStatuses(list as StatusItem[]);
      if (kind === "requestTypes") setRequestTypes(list as SimpleItem[]);
      if (kind === "closureCodes") setClosureCodes(list as SimpleItem[]);
      toast({ title: "Deleted", variant: "success" });
    }
  }

  async function saveSlaForPriority(priorityId: string, field: "respondTime" | "resolveTime", minutes: number) {
    const updated = priorities.map((p) =>
      p.id === priorityId ? { ...p, [field]: minutes } : p
    );
    setPriorities(updated);
    setSlaSaving(true);
    const ok = await saveSetting("priorities", updated);
    setSlaSaving(false);
    if (!ok) toast({ title: "Failed to save SLA", variant: "destructive" });
  }

  const dialogTitle: Record<string, string> = {
    statuses: "Status",
    requestTypes: "Request Type",
    closureCodes: "Closure Code",
  };

  function SimpleTable({
    kind, items, newLabel, showTicketCode = false,
  }: {
    kind: string; items: SimpleItem[]; newLabel: string; showTicketCode?: boolean;
  }) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg">{newLabel}</CardTitle>
            {showTicketCode && (
              <p className="text-xs text-muted-foreground mt-1">
                Ticket ID = Kode + YY + MM + urutan bulan ini (contoh: INC2607001)
              </p>
            )}
          </div>
          <Button size="sm" onClick={() => openNew(kind)}>
            <Plus className="h-4 w-4 mr-1" /> New {dialogTitle[kind]}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No items yet. Click New to add.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  {showTicketCode && <TableHead>Kode ID Ticket</TableHead>}
                  <TableHead className="hidden sm:table-cell">Description</TableHead>
                  {showTicketCode && <TableHead className="hidden md:table-cell">Contoh ID</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => {
                  const code = normalizeTicketCodeInput(item.ticketCode || "");
                  const now = new Date();
                  const yy = now.getFullYear().toString().slice(-2);
                  const mm = (now.getMonth() + 1).toString().padStart(2, "0");
                  const sample = code ? `${code}${yy}${mm}001` : "—";
                  return (
                    <TableRow key={item.id || item.name || index}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      {showTicketCode && (
                        <TableCell>
                          <span className="font-mono text-sm font-semibold text-primary">{code || "—"}</span>
                        </TableCell>
                      )}
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {item.description || "—"}
                      </TableCell>
                      {showTicketCode && (
                        <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">{sample}</TableCell>
                      )}
                      <TableCell className="text-right">
                        <RowSettingsMenu
                          objectName={item.name}
                          onEdit={() => openEdit(kind, item)}
                          onDelete={() => handleDelete(kind, item.id)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    );
  }

  function SlaTimeInput({ priorityId, field, currentMinutes }: {
    priorityId: string; field: "respondTime" | "resolveTime"; currentMinutes: number;
  }) {
    const display = toDisplayTime(currentMinutes || 0);
    const [value, setValue] = useState(display.value);
    const [unit, setUnit] = useState<TimeUnit>(display.unit);

    useEffect(() => {
      const d = toDisplayTime(currentMinutes || 0);
      setValue(d.value);
      setUnit(d.unit);
    }, [currentMinutes]);

    function commit(newValue: number, newUnit: TimeUnit) {
      const mins = toMinutes(Math.max(0, newValue), newUnit);
      saveSlaForPriority(priorityId, field, mins);
    }

    return (
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min={0}
          className="w-20 h-8 text-sm"
          value={value}
          onChange={(e) => {
            const v = parseInt(e.target.value) || 0;
            setValue(v);
          }}
          onBlur={() => commit(value, unit)}
        />
        <Select
          value={unit}
          onValueChange={(v) => {
            const newUnit = v as TimeUnit;
            setUnit(newUnit);
            commit(value, newUnit);
          }}
        >
          <SelectTrigger className="w-24 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minutes">Minutes</SelectItem>
            <SelectItem value="hours">Hours</SelectItem>
            <SelectItem value="days">Days</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (loading) {
    return <LoadingState label="Loading ticket settings" className="h-48" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ticket Settings"
        description="Status, Priority Matrix, SLA, Request Type, Closure Code"
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="statuses">Status</TabsTrigger>
          <TabsTrigger value="matrix">Priority Matrix</TabsTrigger>
          <TabsTrigger value="sla">SLA</TabsTrigger>
          <TabsTrigger value="requestTypes">Request Type</TabsTrigger>
          <TabsTrigger value="closureCodes">Closure Code</TabsTrigger>
        </TabsList>

        {/* Status Tab */}
        <TabsContent value="statuses">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg">Statuses</CardTitle>
                <p className="text-xs text-muted-foreground mt-1 font-normal">
                  Hierarchy (forward only): Pending Approval → Open → On Hold → In Progress →
                  Closed / Reject. Time Stop statuses pause SLA timer.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const next = systemStatusesForSettings() as StatusItem[];
                  if (await saveSetting("ticketStatuses", next)) {
                    setStatuses(next);
                    toast({ title: "Statuses reset to system defaults", variant: "success" });
                  }
                }}
              >
                Reset system statuses
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Color</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Description</TableHead>
                    <TableHead>Timer Stop (SLA)</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statuses.map((s, i) => (
                    <TableRow key={s.id || s.name || i}>
                      <TableCell>
                        <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: s.color }} />
                      </TableCell>
                      <TableCell className="font-medium">
                        {s.name}
                        {s.timerStop ? (
                          <span className="ml-2 text-[11px] font-normal text-muted-foreground">(Time Stop)</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {s.description || "—"}
                      </TableCell>
                      <TableCell>
                        {s.timerStop ? <Badge variant="outline">Timer stops</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <RowSettingsMenu objectName={s.name} onEdit={() => openEdit("statuses", s)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Priority Matrix Tab */}
        <TabsContent value="matrix">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg">Priority Matrix</CardTitle>
                <p className="text-xs text-muted-foreground mt-1 font-normal max-w-2xl">
                  Rows = Impact · Columns = Urgency · Cell = resulting Priority.
                  Ticket priority is auto-derived from Impact × Urgency on creation.
                  {matrixSaving ? " · Saving…" : ""}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={resetMatrixDefaults} disabled={matrixSaving}>
                Reset defaults
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {impacts.length === 0 || urgencies.length === 0 || priorities.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Need Impact, Urgency, and Priority levels loaded (seed defaults).
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-10 bg-card min-w-[7rem]">
                        Impact \ Urgency
                      </TableHead>
                      {urgencies.map((u) => (
                        <TableHead key={u.id || u.name} className="text-center min-w-[8rem]">
                          {u.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {impacts.map((imp) => (
                      <TableRow key={imp.id || imp.name}>
                        <TableCell className="sticky left-0 z-10 bg-card font-medium">
                          {imp.name}
                        </TableCell>
                        {urgencies.map((urg) => {
                          const current =
                            priorityMatrix[imp.name]?.[urg.name] ||
                            DEFAULT_PRIORITY_MATRIX[imp.name]?.[urg.name] ||
                            priorities[0]?.name || "";
                          return (
                            <TableCell key={`${imp.name}-${urg.name}`} className="p-2">
                              <Select
                                value={current || "none"}
                                onValueChange={(v) => {
                                  if (v === "none") return;
                                  void saveMatrixCell(imp.name, urg.name, v);
                                }}
                                disabled={matrixSaving}
                              >
                                <SelectTrigger className="h-9 min-w-[7.5rem]">
                                  <SelectValue placeholder="Priority" />
                                </SelectTrigger>
                                <SelectContent>
                                  {priorities.map((p) => (
                                    <SelectItem key={p.id || p.name} value={p.name}>
                                      {p.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SLA Tab */}
        <TabsContent value="sla">
          <Card>
            <CardHeader className="space-y-0 pb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">SLA per Priority</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-normal">
                Set Respond Time and Resolve Time for each priority level.
                SLA status is binary: <strong>OK</strong> or <strong>Breach</strong>.
                Time can be set in Minutes, Hours, or Days.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {priorities.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No priority levels loaded. Run database seed first.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Priority</TableHead>
                      <TableHead>Respond Time</TableHead>
                      <TableHead className="hidden sm:table-cell">Respond (summary)</TableHead>
                      <TableHead>Resolve Time</TableHead>
                      <TableHead className="hidden sm:table-cell">Resolve (summary)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priorities.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full border" style={{ backgroundColor: p.color }} />
                            <span className="font-medium">{p.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <SlaTimeInput
                            priorityId={p.id}
                            field="respondTime"
                            currentMinutes={p.respondTime || 0}
                          />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {formatDuration(p.respondTime || 0)}
                        </TableCell>
                        <TableCell>
                          <SlaTimeInput
                            priorityId={p.id}
                            field="resolveTime"
                            currentMinutes={p.resolveTime || 0}
                          />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {formatDuration(p.resolveTime || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          {slaSaving && (
            <p className="text-xs text-muted-foreground text-center mt-2">Saving SLA…</p>
          )}
        </TabsContent>

        {/* Request Type Tab */}
        <TabsContent value="requestTypes">
          <SimpleTable kind="requestTypes" items={requestTypes} newLabel="Request Types" showTicketCode />
        </TabsContent>

        {/* Closure Code Tab */}
        <TabsContent value="closureCodes">
          <SimpleTable kind="closureCodes" items={closureCodes} newLabel="Closure Codes" />
        </TabsContent>
      </Tabs>

      {/* Dialog for Status / Request Type / Closure Code */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit" : "New"} {dialogTitle[dialogKind] || "Item"}
            </DialogTitle>
            <DialogDescription>Fill the form and save</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            {dialogKind === "requestTypes" && (
              <div className="space-y-2">
                <Label>Kode ID Ticket *</Label>
                <Input
                  value={form.ticketCode}
                  onChange={(e) => setForm({ ...form, ticketCode: normalizeTicketCodeInput(e.target.value) })}
                  placeholder="e.g. INC or REQ"
                  className="font-mono uppercase"
                  maxLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  Format ticket:{" "}
                  <code className="text-xs">
                    {normalizeTicketCodeInput(form.ticketCode) || "KODE"}
                    {new Date().getFullYear().toString().slice(-2)}
                    {(new Date().getMonth() + 1).toString().padStart(2, "0")}001
                  </code>
                </p>
              </div>
            )}
            {dialogKind === "statuses" && (
              <>
                <div className="flex items-center gap-3">
                  <Switch checked={form.timerStop} onCheckedChange={(v) => setForm({ ...form, timerStop: v })} />
                  <Label>Timer stop (pause SLA while on this status)</Label>
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => setForm({ ...form, color: e.target.value })}
                      className="h-10 w-14 cursor-pointer rounded border"
                    />
                    <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-28" />
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
