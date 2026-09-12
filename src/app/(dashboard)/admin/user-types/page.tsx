"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ResizableDataTable, type ResizableDataTableColumn } from "@/components/ui/resizable-data-table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { RowSettingsMenu } from "@/components/ui/row-settings-menu";

interface UserTypeItem {
  id: string;
  name: string;
  description?: string;
}

export default function UserTypesPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<UserTypeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserTypeItem | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  function withIds(list: UserTypeItem[]): UserTypeItem[] {
    return (list || []).map((x, i) => ({
      ...x,
      id: x.id || `ut-${x.name || i}`,
    }));
  }

  async function load() {
    setLoading(true);
    const res = await fetch("/api/settings?key=userTypes");
    const data = await res.json();
    setItems(withIds(data.data || []));
    setLoading(false);
  }

  async function saveList(next: UserTypeItem[]) {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "userTypes", value: next }),
    });
    return (await res.json()).success;
  }

  function openNew() {
    setEditing(null);
    setForm({ name: "", description: "" });
    setOpen(true);
  }

  function openEdit(item: UserTypeItem) {
    setEditing(item);
    setForm({ name: item.name, description: item.description || "" });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setSaving(true);
    let next: UserTypeItem[];
    if (editing) {
      next = items.map((i) => (i.id === editing.id ? { ...i, ...form } : i));
    } else {
      next = [
        ...items,
        { id: `ut-${Date.now()}`, name: form.name.trim(), description: form.description },
      ];
    }
    if (await saveList(next)) {
      setItems(next);
      setOpen(false);
      toast({ title: editing ? "Updated" : "Created", variant: "success" });
    } else toast({ title: "Failed", variant: "destructive" });
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const next = items.filter((i) => i.id !== id);
    if (await saveList(next)) {
      setItems(next);
      toast({ title: "Deleted", variant: "success" });
    } else toast({ title: "Failed to delete", variant: "destructive" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Roles / User Types</h1>
          <p className="text-muted-foreground">
            Functional types: Requester, Technician, Approver, Auditor (multi-select per user)
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> New User Type
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">User Types</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center h-32 items-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <ResizableDataTable
              storageKey="nexusdesk-user-types-table-columns"
              rows={items}
              rowKey={(item) => item.id}
              emptyMessage="No user types"
              actionsWidth={88}
              renderActions={(item) => (
                <RowSettingsMenu
                  objectName={item.name}
                  onEdit={() => openEdit(item)}
                  onDelete={() => handleDelete(item.id)}
                />
              )}
              columns={
                [
                  {
                    id: "name",
                    label: "Name",
                    width: 180,
                    minWidth: 100,
                    getTooltip: (item) => item.name,
                    render: (item) => <span className="font-medium">{item.name}</span>,
                  },
                  {
                    id: "description",
                    label: "Description",
                    width: 360,
                    minWidth: 140,
                    getTooltip: (item) => item.description || "",
                    render: (item) => (
                      <span className="text-sm text-muted-foreground">
                        {item.description || "—"}
                      </span>
                    ),
                  },
                ] as ResizableDataTableColumn<UserTypeItem>[]
              }
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit User Type" : "New User Type"}</DialogTitle>
            <DialogDescription>Card overlay — name & description</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
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
