"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/providers/auth-provider";
import { generateAssetTag } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

interface UserOption {
  _id: string;
  displayName: string;
}

export default function NewAssetPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [form, setForm] = useState({
    name: "",
    assetType: "",
    assetCategory: "Hardware" as "Hardware" | "Software" | "Consumable",
    assetTag: generateAssetTag(),
    serialNumber: "",
    vendor: "",
    purchaseCost: "",
    purchaseDate: "",
    expiredDate: "",
    warrantyExpiredDate: "",
    currentState: "In Warehouse",
    assignedTo: "",
    site: "",
    comment: "",
    // Software fields
    licenseKey: "",
    totalSeats: "",
    seatsUsed: "",
    // Consumable fields
    stockQuantity: "",
    reorderThreshold: "",
    unit: "",
  });

  const [assetTypes, setAssetTypes] = useState<{ name: string; types: string }[]>([]);
  const [sites, setSites] = useState<{ _id?: string; name: string }[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/users?limit=100").then((r) => r.json()),
      fetch("/api/settings?key=assetTypes").then((r) => r.json()),
      fetch("/api/settings?key=sites").then((r) => r.json()),
    ]).then(([usersRes, typesRes, sitesRes]) => {
      setUsers(usersRes.data || []);
      setAssetTypes(typesRes.data || []);
      setSites(sitesRes.data || []);
    });
  }, []);

  function updateForm(updates: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...updates }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!form.assetType.trim()) {
      toast({ title: "Asset type is required", variant: "destructive" });
      return;
    }
    if (form.assetCategory === "Hardware" && !form.serialNumber.trim()) {
      toast({ title: "Serial number is required for hardware", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        assetType: form.assetType,
        assetCategory: form.assetCategory,
        assetTag: form.assetTag,
        currentState: form.currentState,
      };

      if (form.serialNumber) body.serialNumber = form.serialNumber;
      if (form.vendor) body.vendor = form.vendor;
      if (form.purchaseCost) body.purchaseCost = parseFloat(form.purchaseCost);
      if (form.purchaseDate) body.purchaseDate = form.purchaseDate;
      if (form.expiredDate) body.expiredDate = form.expiredDate;
      if (form.warrantyExpiredDate) body.warrantyExpiredDate = form.warrantyExpiredDate;
      if (form.assignedTo && form.assignedTo !== "none") body.assignedTo = form.assignedTo;
      if (form.site) body.site = form.site;
      if (form.comment) body.comment = form.comment;

      // Software-specific fields
      if (form.assetCategory === "Software") {
        if (form.licenseKey) body.licenseKey = form.licenseKey;
        if (form.totalSeats) body.totalSeats = parseInt(form.totalSeats);
        if (form.seatsUsed) body.seatsUsed = parseInt(form.seatsUsed);
      }

      // Consumable-specific fields
      if (form.assetCategory === "Consumable") {
        if (form.stockQuantity) body.stockQuantity = parseInt(form.stockQuantity);
        if (form.reorderThreshold) body.reorderThreshold = parseInt(form.reorderThreshold);
        if (form.unit) body.unit = form.unit;
      }

      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: "Asset created", description: data.data.assetTag, variant: "success" });
        router.push(`/assets/${data.data._id}`);
      } else {
        toast({ title: data.error || "Failed to create asset", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error creating asset", variant: "destructive" });
    }
    setLoading(false);
  }

  const states = ["In Use", "In Warehouse", "In Repair", "Broken", "Disposed"];
  const categories: Array<"Hardware" | "Software" | "Consumable"> = ["Hardware", "Software", "Consumable"];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/assets"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-2xl font-bold">New Asset</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader><CardTitle>Asset Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm font-medium text-muted-foreground">Header Assets</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => updateForm({ name: e.target.value })} placeholder="Asset name" required />
              </div>
              <div className="space-y-2">
                <Label>Product *</Label>
                {assetTypes.length > 0 ? (
                  <Select
                    value={form.assetType || undefined}
                    onValueChange={(v) => {
                      const t = assetTypes.find((x) => x.name === v);
                      updateForm({
                        assetType: v,
                        assetCategory: (t?.types as "Hardware" | "Software" | "Consumable") || form.assetCategory,
                      });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {assetTypes.map((t) => (
                        <SelectItem key={t.name} value={t.name}>{t.name} ({t.types})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={form.assetType} onChange={(e) => updateForm({ assetType: e.target.value })} placeholder="e.g. Laptop, Monitor" required />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category (Types) *</Label>
              <Select value={form.assetCategory} onValueChange={(v) => updateForm({ assetCategory: v as "Hardware" | "Software" | "Consumable" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <p className="text-sm font-medium text-muted-foreground pt-2">Detail Assets</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Assets Tag *</Label>
                <Input value={form.assetTag} onChange={(e) => updateForm({ assetTag: e.target.value })} placeholder="Auto-generated tag" required />
              </div>
              <div className="space-y-2">
                <Label>Serial Number {form.assetCategory === "Hardware" ? "*" : ""}</Label>
                <Input value={form.serialNumber} onChange={(e) => updateForm({ serialNumber: e.target.value })} placeholder="Serial number" required={form.assetCategory === "Hardware"} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Input value={form.vendor} onChange={(e) => updateForm({ vendor: e.target.value })} placeholder="Vendor name" />
              </div>
              <div className="space-y-2">
                <Label>Purchase Cost</Label>
                <Input type="number" step="0.01" value={form.purchaseCost} onChange={(e) => updateForm({ purchaseCost: e.target.value })} placeholder="0.00" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Expired Date</Label>
                <Input type="date" value={form.expiredDate} onChange={(e) => updateForm({ expiredDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Warranty Expired Date</Label>
                <Input type="date" value={form.warrantyExpiredDate} onChange={(e) => updateForm({ warrantyExpiredDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Purchase Date</Label>
              <Input type="date" value={form.purchaseDate} onChange={(e) => updateForm({ purchaseDate: e.target.value })} />
            </div>

            <p className="text-sm font-medium text-muted-foreground pt-2">Asset State</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Assets is Currently</Label>
                <Select value={form.currentState} onValueChange={(v) => updateForm({ currentState: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {states.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assigned To</Label>
                <Select value={form.assignedTo || "none"} onValueChange={(v) => updateForm({ assignedTo: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {users.map((u) => <SelectItem key={u._id} value={u._id}>{u.displayName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Department</Label>
                <Input disabled className="bg-muted" placeholder="Auto from Assigned To user" value="" />
                <p className="text-xs text-muted-foreground">Filled from user data when assigned</p>
              </div>
              <div className="space-y-2">
                <Label>Site</Label>
                {sites.length > 0 ? (
                  <Select value={form.site || "none"} onValueChange={(v) => updateForm({ site: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {sites.map((s) => (
                        <SelectItem key={s._id || s.name} value={s.name}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={form.site} onChange={(e) => updateForm({ site: e.target.value })} placeholder="Site name" />
                )}
              </div>
            </div>

            {/* Software-specific fields */}
            {form.assetCategory === "Software" && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-medium text-muted-foreground">Software Details</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>License Key</Label>
                    <Input value={form.licenseKey} onChange={(e) => updateForm({ licenseKey: e.target.value })} placeholder="License key" />
                  </div>
                  <div className="space-y-2">
                    <Label>Total Seats</Label>
                    <Input type="number" value={form.totalSeats} onChange={(e) => updateForm({ totalSeats: e.target.value })} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>Seats Used</Label>
                    <Input type="number" value={form.seatsUsed} onChange={(e) => updateForm({ seatsUsed: e.target.value })} placeholder="0" />
                  </div>
                </div>
              </div>
            )}

            {/* Consumable-specific fields */}
            {form.assetCategory === "Consumable" && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-medium text-muted-foreground">Consumable Details</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Stock Quantity</Label>
                    <Input type="number" value={form.stockQuantity} onChange={(e) => updateForm({ stockQuantity: e.target.value })} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>Reorder Threshold</Label>
                    <Input type="number" value={form.reorderThreshold} onChange={(e) => updateForm({ reorderThreshold: e.target.value })} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Input value={form.unit} onChange={(e) => updateForm({ unit: e.target.value })} placeholder="e.g. pcs, boxes" />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Assets Comment</Label>
              <Textarea value={form.comment} onChange={(e) => updateForm({ comment: e.target.value })} placeholder="Additional notes..." rows={3} />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Link href="/assets"><Button variant="outline">Cancel</Button></Link>
              <Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create Asset"}</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
