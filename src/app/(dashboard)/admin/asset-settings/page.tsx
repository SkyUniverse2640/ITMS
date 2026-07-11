"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { RowSettingsMenu } from "@/components/ui/row-settings-menu";

interface AssetType {
  id: string;
  name: string;
  apiname: string;
  description?: string;
  category: string;
  type: string;
}

interface AssetState {
  id: string;
  name: string;
  description?: string;
}

const CATEGORIES = ["IT", "Non-IT"];
const TYPES = ["Hardware", "Software", "Consumable"];

export default function AssetSettingsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("assetTypes");

  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [atDialog, setAtDialog] = useState(false);
  const [editingAt, setEditingAt] = useState<AssetType | null>(null);
  const [atForm, setAtForm] = useState({ name: "", apiname: "", description: "", category: "IT", type: "Hardware" });

  const [assetStates, setAssetStates] = useState<AssetState[]>([]);
  const [asDialog, setAsDialog] = useState(false);
  const [editingAs, setEditingAs] = useState<AssetState | null>(null);
  const [asForm, setAsForm] = useState({ name: "", description: "" });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadSetting(key: string) {
    try {
      const res = await fetch(`/api/settings?key=${key}`);
      const data = await res.json();
      if (data.success && data.data !== undefined && data.data !== null) return data.data;
    } catch {}
    return null;
  }

  async function saveSetting(key: string, value: unknown) {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    const data = await res.json();
    return data.success;
  }

  function genId() {
    return Math.random().toString(36).slice(2, 10);
  }

  function withIds<T extends { id?: string; name?: string; apiname?: string; types?: string; type?: string }>(
    items: T[]
  ): (T & { id: string })[] {
    if (!Array.isArray(items)) return [];
    const used = new Set<string>();
    return items.map((item, index) => {
      // seed uses `types` field; UI may use `type`
      let id = item.id || item.apiname || (item.name ? `seed-${item.name}` : `item-${index}`);
      if (used.has(id)) id = `${id}-${index}`;
      used.add(id);
      return { ...item, id };
    });
  }

  async function loadAll() {
    setLoading(true);
    const [at, as_] = await Promise.all([
      loadSetting("assetTypes"),
      loadSetting("assetStates"),
    ]);
    if (at) {
      // Normalize seed shape: `types` → `type`
      const normalized = (at as Record<string, unknown>[]).map((item) => ({
        ...item,
        type: (item.type as string) || (item.types as string) || "Hardware",
      }));
      setAssetTypes(withIds(normalized as AssetType[]) as AssetType[]);
    }
    if (as_) setAssetStates(withIds(as_ as AssetState[]) as AssetState[]);
    setLoading(false);
  }

  // --- Asset Types ---
  function openNewAt() {
    setEditingAt(null);
    setAtForm({ name: "", apiname: "", description: "", category: "IT", type: "Hardware" });
    setAtDialog(true);
  }
  function openEditAt(item: AssetType) {
    setEditingAt(item);
    setAtForm({ name: item.name, apiname: item.apiname, description: item.description || "", category: item.category, type: item.type });
    setAtDialog(true);
  }
  async function saveAt() {
    if (!atForm.name.trim() || !atForm.apiname.trim()) { toast({ title: "Name and API name are required", variant: "destructive" }); return; }
    setSaving(true);
    let updated: AssetType[];
    if (editingAt) {
      updated = assetTypes.map((a) => a.id === editingAt.id ? { ...a, ...atForm } : a);
    } else {
      updated = [...assetTypes, { id: genId(), ...atForm }];
    }
    if (await saveSetting("assetTypes", updated)) {
      setAssetTypes(updated);
      setAtDialog(false);
      toast({ title: editingAt ? "Asset type updated" : "Asset type created", variant: "success" });
    } else {
      toast({ title: "Failed to save", variant: "destructive" });
    }
    setSaving(false);
  }
  async function deleteAt(id: string) {
    const updated = assetTypes.filter((a) => a.id !== id);
    if (await saveSetting("assetTypes", updated)) {
      setAssetTypes(updated);
      toast({ title: "Asset type deleted", variant: "success" });
    } else toast({ title: "Failed to delete", variant: "destructive" });
  }

  // --- Asset States ---
  function openNewAs() {
    setEditingAs(null);
    setAsForm({ name: "", description: "" });
    setAsDialog(true);
  }
  function openEditAs(item: AssetState) {
    setEditingAs(item);
    setAsForm({ name: item.name, description: item.description || "" });
    setAsDialog(true);
  }
  async function saveAs() {
    if (!asForm.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    setSaving(true);
    let updated: AssetState[];
    if (editingAs) {
      updated = assetStates.map((a) => a.id === editingAs.id ? { ...a, ...asForm } : a);
    } else {
      updated = [...assetStates, { id: genId(), ...asForm }];
    }
    if (await saveSetting("assetStates", updated)) {
      setAssetStates(updated);
      setAsDialog(false);
      toast({ title: editingAs ? "Asset state updated" : "Asset state created", variant: "success" });
    } else {
      toast({ title: "Failed to save", variant: "destructive" });
    }
    setSaving(false);
  }
  async function deleteAs(id: string) {
    const updated = assetStates.filter((a) => a.id !== id);
    if (await saveSetting("assetStates", updated)) {
      setAssetStates(updated);
      toast({ title: "Asset state deleted", variant: "success" });
    } else toast({ title: "Failed to delete", variant: "destructive" });
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
        <h1 className="text-2xl font-bold">Asset Settings</h1>
        <p className="text-muted-foreground">Configure asset types and states</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="assetTypes">Asset Types</TabsTrigger>
          <TabsTrigger value="assetStates">Asset States</TabsTrigger>
        </TabsList>

        <TabsContent value="assetTypes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg">Asset Types</CardTitle>
              <Button size="sm" onClick={openNewAt}><Plus className="h-4 w-4 mr-1" /> New Asset Type</Button>
            </CardHeader>
            <CardContent className="p-0">
              {assetTypes.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No asset types configured yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>API Name</TableHead>
                      <TableHead className="hidden md:table-cell">Category</TableHead>
                      <TableHead className="hidden md:table-cell">Type</TableHead>
                      <TableHead className="hidden lg:table-cell">Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assetTypes.map((at, index) => (
                      <TableRow key={at.id || at.apiname || at.name || `at-${index}`}>
                        <TableCell className="font-medium">{at.name}</TableCell>
                        <TableCell className="font-mono text-sm">{at.apiname}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline">{at.category}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="secondary">{at.type}</Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{at.description || "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <RowSettingsMenu
                              objectName={at.name}
                              onEdit={() => openEditAt(at)}
                              onDelete={() => deleteAt(at.id || at.apiname || at.name)}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Dialog open={atDialog} onOpenChange={setAtDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingAt ? "Edit Asset Type" : "New Asset Type"}</DialogTitle>
                <DialogDescription>{editingAt ? "Update the asset type." : "Create a new asset type."}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input value={atForm.name} onChange={(e) => setAtForm({ ...atForm, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>API Name *</Label>
                    <Input value={atForm.apiname} onChange={(e) => setAtForm({ ...atForm, apiname: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={atForm.description} onChange={(e) => setAtForm({ ...atForm, description: e.target.value })} rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={atForm.category} onValueChange={(v) => setAtForm({ ...atForm, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={atForm.type} onValueChange={(v) => setAtForm({ ...atForm, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAtDialog(false)}>Cancel</Button>
                <Button onClick={saveAt} disabled={saving}>{saving ? "Saving..." : editingAt ? "Update" : "Create"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="assetStates">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg">Asset States</CardTitle>
              <Button size="sm" onClick={openNewAs}><Plus className="h-4 w-4 mr-1" /> New Asset State</Button>
            </CardHeader>
            <CardContent className="p-0">
              {assetStates.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No asset states configured yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assetStates.map((as_, index) => (
                      <TableRow key={as_.id || as_.name || `as-${index}`}>
                        <TableCell className="font-medium">{as_.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{as_.description || "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <RowSettingsMenu
                              objectName={as_.name}
                              onEdit={() => openEditAs(as_)}
                              onDelete={() => deleteAs(as_.id || as_.name)}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Dialog open={asDialog} onOpenChange={setAsDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingAs ? "Edit Asset State" : "New Asset State"}</DialogTitle>
                <DialogDescription>{editingAs ? "Update the asset state." : "Create a new asset state."}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input value={asForm.name} onChange={(e) => setAsForm({ ...asForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={asForm.description} onChange={(e) => setAsForm({ ...asForm, description: e.target.value })} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAsDialog(false)}>Cancel</Button>
                <Button onClick={saveAs} disabled={saving}>{saving ? "Saving..." : editingAs ? "Update" : "Create"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
