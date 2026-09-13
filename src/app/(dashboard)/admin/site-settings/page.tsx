"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Plus } from "lucide-react";
import { RowSettingsMenu } from "@/components/ui/row-settings-menu";

interface Site {
  _id?: string;
  name: string;
  address?: string;
  timezone: string;
}

const TIMEZONES = [
  "Asia/Jakarta", "Asia/Singapore", "Asia/Bangkok", "Asia/Tokyo", "Asia/Shanghai",
  "Asia/Kolkata", "Asia/Dubai", "Europe/London", "Europe/Paris", "America/New_York",
  "America/Los_Angeles", "UTC",
];

export default function SiteSettingsPage() {
  const { toast } = useToast();
  const [sites, setSites] = useState<Site[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);
  const [form, setForm] = useState<Site>({ name: "", address: "", timezone: "Asia/Jakarta" });

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await fetch("/api/settings?key=sites");
    const data = await res.json();
    setSites(data.data || []);
  }

  async function save() {
    if (!form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    let updated: Site[];
    if (editing) {
      updated = sites.map((s) => (s._id === editing._id ? { ...form, _id: editing._id } : s));
    } else {
      updated = [...sites, { ...form, _id: Math.random().toString(36).slice(2) }];
    }
    await fetch("/api/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "sites", value: updated }),
    });
    setSites(updated);
    setOpen(false);
    setEditing(null);
    setForm({ name: "", address: "", timezone: "Asia/Jakarta" });
    toast({ title: editing ? "Site updated" : "Site created", variant: "success" });
  }

  async function remove(id: string) {
    const updated = sites.filter((s) => s._id !== id);
    await fetch("/api/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "sites", value: updated }),
    });
    setSites(updated);
    toast({ title: "Site deleted", variant: "success" });
  }

  function openEdit(s: Site) {
    setEditing(s);
    setForm(s);
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Site Settings"
        description="Manage organization sites and locations"
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm({ name: "", address: "", timezone: "Asia/Jakarta" }); } }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> New Site</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit Site" : "New Site"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Address</TableHead><TableHead>Timezone</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {sites.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No sites configured</TableCell></TableRow>
              ) : sites.map((s) => (
                <TableRow key={s._id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.address || "—"}</TableCell>
                  <TableCell>{s.timezone}</TableCell>
                  <TableCell>
                    <RowSettingsMenu
                      objectName={s.name}
                      onEdit={() => openEdit(s)}
                      onDelete={() => remove(s._id!)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
