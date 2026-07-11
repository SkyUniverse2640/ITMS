"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { GENERAL_NAV, DEFAULT_NAV_ACCESS, type NavAccessMap } from "@/lib/nav-config";
import type { UserType } from "@/types";
import { Save, GripVertical } from "lucide-react";
import { usePreferences } from "@/components/providers/preferences-provider";

const ALL_TYPES: UserType[] = ["Requester", "Technician", "Approver", "Auditor"];

export default function NavAccessPage() {
  const { toast } = useToast();
  const { menuOrder, setMenuOrder } = usePreferences();
  const [access, setAccess] = useState<NavAccessMap>(DEFAULT_NAV_ACCESS);
  const [order, setOrder] = useState<string[]>(GENERAL_NAV.map((n) => n.id));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings?key=navAccess").then((r) => r.json()),
      fetch("/api/settings?key=navOrder").then((r) => r.json()),
    ]).then(([a, o]) => {
      if (a.data) setAccess(a.data);
      if (Array.isArray(o.data) && o.data.length) setOrder(o.data);
      else if (menuOrder.length) setOrder(menuOrder);
      setLoading(false);
    });
  }, [menuOrder]);

  function isChecked(navId: string, type: UserType) {
    const allowed = access[navId] ?? "all";
    if (allowed === "all") return true;
    return allowed.includes(type);
  }

  function toggle(navId: string, type: UserType) {
    setAccess((prev) => {
      const current = prev[navId] ?? "all";
      let list: UserType[] =
        current === "all" ? [...ALL_TYPES] : [...(current as UserType[])];
      if (list.includes(type)) list = list.filter((t) => t !== type);
      else list.push(type);
      if (list.length === ALL_TYPES.length) return { ...prev, [navId]: "all" };
      if (list.length === 0) list = ["Requester"]; // at least one
      return { ...prev, [navId]: list };
    });
  }

  function move(id: string, dir: -1 | 1) {
    setOrder((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await Promise.all([
        fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "navAccess", value: access }),
        }),
        fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "navOrder", value: order }),
        }),
      ]);
      setMenuOrder(order);
      toast({ title: "Navbar access & order saved", variant: "success" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center h-64 items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const orderedNav = [...GENERAL_NAV].sort(
    (a, b) => order.indexOf(a.id) - order.indexOf(b.id)
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Navbar Access</h1>
          <p className="text-muted-foreground">
            Dynamic Navbar — set accessibility per User Type & reorder general menus
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">General Feature menus</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {orderedNav.map((item, idx) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border p-4"
            >
              <div className="flex items-center gap-2 min-w-[140px]">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{item.label}</span>
                <div className="flex gap-1 ml-auto sm:ml-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={idx === 0}
                    onClick={() => move(item.id, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={idx === orderedNav.length - 1}
                    onClick={() => move(item.id, 1)}
                  >
                    ↓
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 flex-1">
                {ALL_TYPES.map((type) => (
                  <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={isChecked(item.id, type)}
                      onCheckedChange={() => toggle(item.id, type)}
                    />
                    {type}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        SuperAdmin menus are only visible to SuperAdmin role (Audit Trail also for Auditor).
      </p>
    </div>
  );
}
