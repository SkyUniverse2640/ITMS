"use client";

/**
 * Ticket Settings — SuperAdmin Requests Management
 * Status, Impact, Urgency, Priority (+SLA), Request Type, Closure Code
 */
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
import { Plus } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { notifyTicketMetaChanged } from "@/components/providers/ticket-meta-provider";
import { RowSettingsMenu } from "@/components/ui/row-settings-menu";
import {
  needsStatusMigration,
  systemStatusesForSettings,
} from "@/lib/ticket-status";

interface SimpleItem {
  id: string;
  name: string;
  description?: string;
  /** Ticket ID prefix for Request Type (e.g. INC, REQ) → INC2607001 */
  ticketCode?: string;
}

interface StatusItem extends SimpleItem {
  timerStop: boolean;
  color: string;
}

interface PriorityItem extends SimpleItem {
  color: string;
  slaId?: string;
}

interface SLAOption {
  id: string;
  name: string;
  duration: number;
}

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

export default function TicketSettingsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState("statuses");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [impacts, setImpacts] = useState<SimpleItem[]>([]);
  const [urgencies, setUrgencies] = useState<SimpleItem[]>([]);
  const [priorities, setPriorities] = useState<PriorityItem[]>([]);
  const [requestTypes, setRequestTypes] = useState<SimpleItem[]>([]);
  const [closureCodes, setClosureCodes] = useState<SimpleItem[]>([]);
  const [slas, setSlas] = useState<SLAOption[]>([]);

  // dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKind, setDialogKind] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    timerStop: false,
    color: "#3b82f6",
    slaId: "",
    ticketCode: "",
  });

  useEffect(() => {
    loadAll();
  }, []);

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
    // Push live colors to dashboard / Requests / ticket detail
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
    return raw
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8);
  }

  async function loadAll() {
    setLoading(true);
    const [s, i, u, p, rt, cc, sla] = await Promise.all([
      loadSetting("ticketStatuses"),
      loadSetting("impacts"),
      loadSetting("urgencies"),
      loadSetting("priorities"),
      loadSetting("requestTypes"),
      loadSetting("closureCodes"),
      loadSetting("slaConfigs"),
    ]);
    // Migrate to 6 system statuses (Pending Approval, Open, On Hold, In Progress, Closed, Reject)
    if (needsStatusMigration(s)) {
      const next = systemStatusesForSettings() as StatusItem[];
      await saveSetting("ticketStatuses", next);
      setStatuses(next);
      toast({
        title: "Ticket statuses updated",
        description: "Now using the 6 system statuses with Time Stop flags",
        variant: "success",
      });
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
    if (Array.isArray(sla)) {
      setSlas(
        sla.map((x: { id?: string; name: string; duration: number }, idx: number) => ({
          id: x.id || `sla-${idx}`,
          name: x.name,
          duration: x.duration,
        }))
      );
    }
    setLoading(false);
  }

  const keyMap: Record<string, string> = {
    statuses: "ticketStatuses",
    impacts: "impacts",
    urgencies: "urgencies",
    priorities: "priorities",
    requestTypes: "requestTypes",
    closureCodes: "closureCodes",
  };

  function openNew(kind: string) {
    setDialogKind(kind);
    setEditingId(null);
    setForm({
      name: "",
      description: "",
      timerStop: false,
      color: "#3b82f6",
      slaId: "",
      ticketCode: "",
    });
    setDialogOpen(true);
  }

  function openEdit(kind: string, item: SimpleItem | StatusItem | PriorityItem) {
    setDialogKind(kind);
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description || "",
      timerStop: "timerStop" in item ? !!(item as StatusItem).timerStop : false,
      color: "color" in item ? (item as StatusItem).color || "#3b82f6" : "#3b82f6",
      slaId: "slaId" in item ? (item as PriorityItem).slaId || "" : "",
      ticketCode: "ticketCode" in item ? String((item as SimpleItem).ticketCode || "") : "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    if (dialogKind === "requestTypes") {
      const code = normalizeTicketCodeInput(form.ticketCode);
      if (code.length < 2) {
        toast({
          title: "Kode ID Ticket required",
          description: "Min. 2 characters (A–Z, 0–9), e.g. INC or REQ",
          variant: "destructive",
        });
        return;
      }
      // Unique code among request types
      const dup = requestTypes.some(
        (rt) =>
          rt.id !== editingId &&
          normalizeTicketCodeInput(rt.ticketCode || "") === code
      );
      if (dup) {
        toast({ title: "Kode ID Ticket already used by another Request Type", variant: "destructive" });
        return;
      }
    }
    setSaving(true);
    const key = keyMap[dialogKind];
    let list: unknown[] = [];

    if (dialogKind === "statuses") list = [...statuses];
    else if (dialogKind === "impacts") list = [...impacts];
    else if (dialogKind === "urgencies") list = [...urgencies];
    else if (dialogKind === "priorities") list = [...priorities];
    else if (dialogKind === "requestTypes") list = [...requestTypes];
    else if (dialogKind === "closureCodes") list = [...closureCodes];

    const ticketCode = normalizeTicketCodeInput(form.ticketCode);

    if (editingId) {
      list = (list as SimpleItem[]).map((item) => {
        if (item.id !== editingId) return item;
        if (dialogKind === "statuses") {
          return { ...item, name: form.name, description: form.description, timerStop: form.timerStop, color: form.color };
        }
        if (dialogKind === "priorities") {
          return { ...item, name: form.name, description: form.description, color: form.color, slaId: form.slaId || undefined };
        }
        if (dialogKind === "requestTypes") {
          return { ...item, name: form.name, description: form.description, ticketCode };
        }
        return { ...item, name: form.name, description: form.description };
      });
    } else {
      const base = { id: genId(), name: form.name.trim(), description: form.description };
      if (dialogKind === "statuses") {
        list = [...list, { ...base, timerStop: form.timerStop, color: form.color }];
      } else if (dialogKind === "priorities") {
        list = [...list, { ...base, color: form.color, slaId: form.slaId || undefined }];
      } else if (dialogKind === "requestTypes") {
        list = [...list, { ...base, ticketCode }];
      } else {
        list = [...list, base];
      }
    }

    if (await saveSetting(key, list)) {
      if (dialogKind === "statuses") setStatuses(list as StatusItem[]);
      if (dialogKind === "impacts") setImpacts(list as SimpleItem[]);
      if (dialogKind === "urgencies") setUrgencies(list as SimpleItem[]);
      if (dialogKind === "priorities") setPriorities(list as PriorityItem[]);
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
    if (kind === "impacts") list = impacts.filter((x) => x.id !== id);
    if (kind === "urgencies") list = urgencies.filter((x) => x.id !== id);
    if (kind === "priorities") list = priorities.filter((x) => x.id !== id) as SimpleItem[];
    if (kind === "requestTypes") list = requestTypes.filter((x) => x.id !== id);
    if (kind === "closureCodes") list = closureCodes.filter((x) => x.id !== id);

    if (await saveSetting(key, list)) {
      if (kind === "statuses") setStatuses(list as StatusItem[]);
      if (kind === "impacts") setImpacts(list);
      if (kind === "urgencies") setUrgencies(list);
      if (kind === "priorities") setPriorities(list as PriorityItem[]);
      if (kind === "requestTypes") setRequestTypes(list);
      if (kind === "closureCodes") setClosureCodes(list);
      toast({ title: "Deleted", variant: "success" });
    } else toast({ title: "Failed to delete", variant: "destructive" });
  }

  const dialogTitle: Record<string, string> = {
    statuses: "Status",
    impacts: "Impact",
    urgencies: "Urgency",
    priorities: "Priority",
    requestTypes: "Request Type",
    closureCodes: "Closure Code",
  };

  function SimpleTable({
    kind,
    items,
    newLabel,
    showTicketCode = false,
  }: {
    kind: string;
    items: SimpleItem[];
    newLabel: string;
    showTicketCode?: boolean;
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
                  {showTicketCode && (
                    <TableHead className="hidden md:table-cell">Contoh ID</TableHead>
                  )}
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
                          <span className="font-mono text-sm font-semibold text-primary">
                            {code || "—"}
                          </span>
                        </TableCell>
                      )}
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {item.description || "—"}
                      </TableCell>
                      {showTicketCode && (
                        <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">
                          {sample}
                        </TableCell>
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ticket Settings</h1>
        <p className="text-muted-foreground">
          Status, Impact, Urgency, Priority, Request Type, Closure Code
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="statuses">Status</TabsTrigger>
          <TabsTrigger value="impacts">Impact</TabsTrigger>
          <TabsTrigger value="urgencies">Urgency</TabsTrigger>
          <TabsTrigger value="priorities">Priority</TabsTrigger>
          <TabsTrigger value="requestTypes">Request Type</TabsTrigger>
          <TabsTrigger value="closureCodes">Closure Code</TabsTrigger>
        </TabsList>

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
                          <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                            (Time Stop)
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {s.description || "—"}
                      </TableCell>
                      <TableCell>
                        {s.timerStop ? <Badge variant="outline">Timer stops</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <RowSettingsMenu
                          objectName={s.name}
                          onEdit={() => openEdit("statuses", s)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="impacts">
          <SimpleTable kind="impacts" items={impacts} newLabel="Impacts" />
        </TabsContent>
        <TabsContent value="urgencies">
          <SimpleTable kind="urgencies" items={urgencies} newLabel="Urgencies" />
        </TabsContent>

        <TabsContent value="priorities">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg">Priorities</CardTitle>
              <Button size="sm" onClick={() => openNew("priorities")}>
                <Plus className="h-4 w-4 mr-1" /> New Priority
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Color</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>SLA</TableHead>
                    <TableHead className="hidden sm:table-cell">Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {priorities.map((p, i) => (
                    <TableRow key={p.id || p.name || i}>
                      <TableCell>
                        <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: p.color }} />
                      </TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-sm">
                        {slas.find((s) => s.id === p.slaId)?.name || "—"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {p.description || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <RowSettingsMenu
                          objectName={p.name}
                          onEdit={() => openEdit("priorities", p)}
                          onDelete={() => handleDelete("priorities", p.id)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requestTypes">
          <SimpleTable
            kind="requestTypes"
            items={requestTypes}
            newLabel="Request Types"
            showTicketCode
          />
        </TabsContent>
        <TabsContent value="closureCodes">
          <SimpleTable kind="closureCodes" items={closureCodes} newLabel="Closure Codes" />
        </TabsContent>
      </Tabs>

      {/* Card overlay */}
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
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
            {dialogKind === "requestTypes" && (
              <div className="space-y-2">
                <Label>Kode ID Ticket *</Label>
                <Input
                  value={form.ticketCode}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      ticketCode: normalizeTicketCodeInput(e.target.value),
                    })
                  }
                  placeholder="e.g. INC or REQ"
                  className="font-mono uppercase"
                  maxLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  Format ticket:{" "}
                  <code className="text-xs">
                    {normalizeTicketCodeInput(form.ticketCode) || "KODE"}
                    {new Date().getFullYear().toString().slice(-2)}
                    {(new Date().getMonth() + 1).toString().padStart(2, "0")}
                    001
                  </code>{" "}
                  — Kode + tahun (YY) + bulan (MM) + urutan di bulan ini (001, 002, …)
                </p>
              </div>
            )}
            {dialogKind === "statuses" && (
              <>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={form.timerStop}
                    onCheckedChange={(v) => setForm({ ...form, timerStop: v })}
                  />
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
                    <Input
                      value={form.color}
                      onChange={(e) => setForm({ ...form, color: e.target.value })}
                      className="w-28"
                    />
                  </div>
                </div>
              </>
            )}
            {dialogKind === "priorities" && (
              <>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => setForm({ ...form, color: e.target.value })}
                      className="h-10 w-14 cursor-pointer rounded border"
                    />
                    <Input
                      value={form.color}
                      onChange={(e) => setForm({ ...form, color: e.target.value })}
                      className="w-28"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>SLA</Label>
                  <Select
                    value={form.slaId || "none"}
                    onValueChange={(v) => setForm({ ...form, slaId: v === "none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select SLA" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {slas.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.duration} min)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
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
    </div>
  );
}
