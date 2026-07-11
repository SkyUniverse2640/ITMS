"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Clock, X } from "lucide-react";
import { RowSettingsMenu } from "@/components/ui/row-settings-menu";
import { useToast } from "@/components/ui/toast";

interface EscalationThreshold {
  percentage: number;
  notifyRoles: string[];
}

interface BusinessHours {
  days: string[];
  startHour: number;
  endHour: number;
}

interface SLAConfig {
  id: string;
  name: string;
  description?: string;
  duration: number;
  businessHours: BusinessHours;
  holidays: string[];
  escalation: EscalationThreshold[];
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Includes department hierarchy labels (Director / Manager / Supervisor) for SLA breach notify */
const NOTIFY_ROLES = ["Director", "Manager", "Supervisor", "Technician", "SuperAdmin"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const emptyForm: Omit<SLAConfig, "id"> = {
  name: "",
  description: "",
  duration: 60,
  businessHours: { days: ["Mon", "Tue", "Wed", "Thu", "Fri"], startHour: 9, endHour: 17 },
  holidays: [],
  escalation: [],
};

export default function SLASettingsPage() {
  const { toast } = useToast();
  const [slas, setSlas] = useState<SLAConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSla, setEditingSla] = useState<SLAConfig | null>(null);
  const [form, setForm] = useState<Omit<SLAConfig, "id">>(emptyForm);
  const [newHoliday, setNewHoliday] = useState("");

  useEffect(() => {
    loadSlas();
  }, []);

  async function loadSlas() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings?key=slaConfigs");
      const data = await res.json();
      if (data.success && data.data && Array.isArray(data.data)) {
        const used = new Set<string>();
        setSlas(
          data.data.map((sla: SLAConfig, index: number) => {
            let id = sla.id || (sla.name ? `sla-${sla.name}` : `sla-${index}`);
            if (used.has(id)) id = `${id}-${index}`;
            used.add(id);
            return { ...sla, id };
          })
        );
      }
    } catch {}
    setLoading(false);
  }

  async function saveSlas(updated: SLAConfig[]) {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "slaConfigs", value: updated }),
    });
    const data = await res.json();
    return data.success;
  }

  function genId() {
    return Math.random().toString(36).slice(2, 10);
  }

  function openNew() {
    setEditingSla(null);
    setForm({ ...emptyForm, businessHours: { ...emptyForm.businessHours, days: [...emptyForm.businessHours.days] }, holidays: [], escalation: [] });
    setNewHoliday("");
    setDialogOpen(true);
  }

  function openEdit(sla: SLAConfig) {
    setEditingSla(sla);
    setForm({
      name: sla.name,
      description: sla.description || "",
      duration: sla.duration,
      businessHours: { ...sla.businessHours, days: [...sla.businessHours.days] },
      holidays: [...sla.holidays],
      escalation: sla.escalation.map((e) => ({ ...e, notifyRoles: [...e.notifyRoles] })),
    });
    setNewHoliday("");
    setDialogOpen(true);
  }

  function toggleDay(day: string) {
    setForm((prev) => {
      const days = prev.businessHours.days.includes(day)
        ? prev.businessHours.days.filter((d) => d !== day)
        : [...prev.businessHours.days, day];
      return { ...prev, businessHours: { ...prev.businessHours, days } };
    });
  }

  function addHoliday() {
    if (!newHoliday) return;
    if (form.holidays.includes(newHoliday)) return;
    setForm({ ...form, holidays: [...form.holidays, newHoliday] });
    setNewHoliday("");
  }

  function removeHoliday(date: string) {
    setForm({ ...form, holidays: form.holidays.filter((h) => h !== date) });
  }

  function addEscalation() {
    setForm({
      ...form,
      escalation: [...form.escalation, { percentage: 75, notifyRoles: ["Technician"] }],
    });
  }

  function updateEscalation(idx: number, field: string, value: unknown) {
    const updated = [...form.escalation];
    updated[idx] = { ...updated[idx], [field]: value };
    setForm({ ...form, escalation: updated });
  }

  function removeEscalation(idx: number) {
    setForm({ ...form, escalation: form.escalation.filter((_, i) => i !== idx) });
  }

  function toggleEscalationRole(idx: number, role: string) {
    const esc = form.escalation[idx];
    const has = esc.notifyRoles.includes(role);
    const roles = has ? esc.notifyRoles.filter((r) => r !== role) : [...esc.notifyRoles, role];
    updateEscalation(idx, "notifyRoles", roles.length ? roles : esc.notifyRoles);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    if (form.duration <= 0) { toast({ title: "Duration must be positive", variant: "destructive" }); return; }
    setSaving(true);
    let updated: SLAConfig[];
    if (editingSla) {
      updated = slas.map((s) => s.id === editingSla.id ? { ...s, ...form } : s);
    } else {
      updated = [...slas, { id: genId(), ...form }];
    }
    if (await saveSlas(updated)) {
      setSlas(updated);
      setDialogOpen(false);
      toast({ title: editingSla ? "SLA updated" : "SLA created", variant: "success" });
    } else {
      toast({ title: "Failed to save", variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const updated = slas.filter((s) => s.id !== id);
    if (await saveSlas(updated)) {
      setSlas(updated);
      toast({ title: "SLA deleted", variant: "success" });
    } else toast({ title: "Failed to delete", variant: "destructive" });
  }

  function formatDuration(mins: number) {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">SLA Settings</h1>
          <p className="text-muted-foreground">Configure Service Level Agreements</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> New SLA</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {slas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Clock className="h-10 w-10 mb-2 opacity-40" />
              <p>No SLAs configured yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="hidden md:table-cell">Business Hours</TableHead>
                  <TableHead className="hidden lg:table-cell">Escalations</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slas.map((sla) => (
                  <TableRow key={sla.id || sla.name}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{sla.name}</p>
                        {sla.description && <p className="text-xs text-muted-foreground">{sla.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{formatDuration(sla.duration)}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {sla.businessHours.days.join(", ")} {sla.businessHours.startHour}:00-{sla.businessHours.endHour}:00
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex gap-1">
                        {sla.escalation.map((e, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{e.percentage}%</Badge>
                        ))}
                        {sla.escalation.length === 0 && <span className="text-muted-foreground text-sm">None</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <RowSettingsMenu
                        objectName={sla.name}
                        onEdit={() => openEdit(sla)}
                        onDelete={() => handleDelete(sla.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSla ? "Edit SLA" : "New SLA"}</DialogTitle>
            <DialogDescription>
              {editingSla ? "Update the SLA configuration." : "Define a new SLA configuration."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Duration (minutes) *</Label>
                <Input type="number" min={1} value={form.duration} onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) || 0 })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-base font-semibold">Business Hours</Label>
              <div className="space-y-2">
                <Label className="text-sm">Working Days</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => (
                    <label key={day} className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={form.businessHours.days.includes(day)}
                        onCheckedChange={() => toggleDay(day)}
                      />
                      <span className="text-sm">{day}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Start Hour</Label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={form.businessHours.startHour}
                    onChange={(e) => setForm({ ...form, businessHours: { ...form.businessHours, startHour: parseInt(e.target.value) || 0 } })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">End Hour</Label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={form.businessHours.endHour}
                    onChange={(e) => setForm({ ...form, businessHours: { ...form.businessHours, endHour: parseInt(e.target.value) || 0 } })}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-base font-semibold">Holidays</Label>
              <div className="flex gap-2">
                <Input type="date" value={newHoliday} onChange={(e) => setNewHoliday(e.target.value)} />
                <Button type="button" variant="outline" size="sm" onClick={addHoliday}>Add</Button>
              </div>
              {form.holidays.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.holidays.map((h) => (
                    <Badge key={h} variant="secondary" className="gap-1">
                      {h}
                      <button onClick={() => removeHoliday(h)}><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Escalation Thresholds</Label>
                <Button type="button" variant="outline" size="sm" onClick={addEscalation}>
                  <Plus className="h-3 w-3 mr-1" /> Add Threshold
                </Button>
              </div>
              {form.escalation.map((esc, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">At</Label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        className="w-20"
                        value={esc.percentage}
                        onChange={(e) => updateEscalation(idx, "percentage", parseInt(e.target.value) || 0)}
                      />
                      <Label className="text-sm">% of SLA time</Label>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeEscalation(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {NOTIFY_ROLES.map((role) => (
                      <label key={role} className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox
                          checked={esc.notifyRoles.includes(role)}
                          onCheckedChange={() => toggleEscalationRole(idx, role)}
                        />
                        <span className="text-sm">{role}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {form.escalation.length === 0 && (
                <p className="text-sm text-muted-foreground">No escalation thresholds configured.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingSla ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
