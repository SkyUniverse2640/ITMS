"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/providers/auth-provider";
import { ASSET_STATE_COLORS, formatDate, formatDateTime } from "@/lib/utils";
import { ArrowLeft, Pencil, Trash2, Clock, User } from "lucide-react";

interface AssetData {
  _id: string;
  name: string;
  assetType: string;
  assetCategory: "Hardware" | "Software" | "Consumable";
  assetTag: string;
  serialNumber?: string;
  vendor?: string;
  purchaseCost?: number;
  purchaseDate?: string;
  expiredDate?: string;
  warrantyExpiredDate?: string;
  currentState: string;
  assignedTo?: { _id: string; displayName: string; email: string; department?: string };
  department?: string;
  site?: { _id: string; name: string };
  comment?: string;
  licenseKey?: string;
  totalSeats?: number;
  seatsUsed?: number;
  stockQuantity?: number;
  reorderThreshold?: number;
  unit?: string;
  createdAt: string;
  updatedAt: string;
}

interface UserOption {
  _id: string;
  displayName: string;
}

export default function AssetDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [asset, setAsset] = useState<AssetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    loadAsset();
    fetch("/api/users?limit=100")
      .then((r) => r.json())
      .then((d) => setUsers(d.data || []));
  }, [id]);

  async function loadAsset() {
    try {
      const res = await fetch(`/api/assets/${id}`);
      const data = await res.json();
      if (data.success) {
        setAsset(data.data);
        populateForm(data.data);
      }
    } catch {}
    setLoading(false);
  }

  function populateForm(a: AssetData) {
    setForm({
      name: a.name || "",
      assetType: a.assetType || "",
      assetCategory: a.assetCategory || "Hardware",
      assetTag: a.assetTag || "",
      serialNumber: a.serialNumber || "",
      vendor: a.vendor || "",
      purchaseCost: a.purchaseCost?.toString() || "",
      purchaseDate: a.purchaseDate ? a.purchaseDate.substring(0, 10) : "",
      expiredDate: a.expiredDate ? a.expiredDate.substring(0, 10) : "",
      warrantyExpiredDate: a.warrantyExpiredDate ? a.warrantyExpiredDate.substring(0, 10) : "",
      currentState: a.currentState || "In Warehouse",
      assignedTo: a.assignedTo?._id || "",
      comment: a.comment || "",
      licenseKey: a.licenseKey || "",
      totalSeats: a.totalSeats?.toString() || "",
      seatsUsed: a.seatsUsed?.toString() || "",
      stockQuantity: a.stockQuantity?.toString() || "",
      reorderThreshold: a.reorderThreshold?.toString() || "",
      unit: a.unit || "",
    });
  }

  function updateForm(updates: Record<string, string>) {
    setForm((f) => ({ ...f, ...updates }));
  }

  async function handleSave() {
    setSaving(true);
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
      if (form.assignedTo && form.assignedTo !== "none") {
        body.assignedTo = form.assignedTo;
      } else {
        body.assignedTo = null;
      }
      if (form.comment) body.comment = form.comment;

      // Category-specific fields
      if (form.assetCategory === "Software") {
        body.licenseKey = form.licenseKey || undefined;
        if (form.totalSeats) body.totalSeats = parseInt(form.totalSeats);
        if (form.seatsUsed) body.seatsUsed = parseInt(form.seatsUsed);
      }
      if (form.assetCategory === "Consumable") {
        if (form.stockQuantity) body.stockQuantity = parseInt(form.stockQuantity);
        if (form.reorderThreshold) body.reorderThreshold = parseInt(form.reorderThreshold);
        if (form.unit) body.unit = form.unit;
      }

      const res = await fetch(`/api/assets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        setAsset(data.data);
        populateForm(data.data);
        setEditing(false);
        toast({ title: "Asset updated", variant: "success" });
      } else {
        toast({ title: data.error || "Failed to update asset", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error updating asset", variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Asset deleted", variant: "success" });
        router.push("/assets");
      } else {
        toast({ title: data.error || "Failed to delete asset", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error deleting asset", variant: "destructive" });
    }
    setDeleting(false);
    setDeleteOpen(false);
  }

  function handleCancel() {
    if (asset) populateForm(asset);
    setEditing(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  if (!asset) {
    return <div className="text-center py-16 text-muted-foreground">Asset not found</div>;
  }

  const isSuperAdmin = user?.role === "SuperAdmin";
  const states = ["In Use", "In Warehouse", "In Repair", "Broken", "Disposed"];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/assets"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-muted-foreground">{asset.assetTag}</span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ASSET_STATE_COLORS[asset.currentState] || ""}`}>
              {asset.currentState}
            </span>
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
              {asset.assetCategory}
            </span>
          </div>
          <h1 className="text-xl font-bold mt-1">{asset.name}</h1>
        </div>
        <div className="flex gap-2">
          {isSuperAdmin && !editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </Button>
          )}
          {isSuperAdmin && (
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Asset</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete asset &quot;{asset.name}&quot; ({asset.assetTag})? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                    {deleting ? "Deleting..." : "Delete"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* General Info */}
          <Card>
            <CardHeader><CardTitle className="text-base">General Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={form.name} onChange={(e) => updateForm({ name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Asset Type</Label>
                      <Input value={form.assetType} onChange={(e) => updateForm({ assetType: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={form.assetCategory} onValueChange={(v) => updateForm({ assetCategory: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Hardware">Hardware</SelectItem>
                          <SelectItem value="Software">Software</SelectItem>
                          <SelectItem value="Consumable">Consumable</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Asset Tag</Label>
                      <Input value={form.assetTag} onChange={(e) => updateForm({ assetTag: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Vendor</Label>
                      <Input value={form.vendor} onChange={(e) => updateForm({ vendor: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>State</Label>
                      <Select value={form.currentState} onValueChange={(v) => updateForm({ currentState: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {states.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Purchase Cost</Label>
                      <Input type="number" step="0.01" value={form.purchaseCost} onChange={(e) => updateForm({ purchaseCost: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Purchase Date</Label>
                      <Input type="date" value={form.purchaseDate} onChange={(e) => updateForm({ purchaseDate: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Expiry Date</Label>
                      <Input type="date" value={form.expiredDate} onChange={(e) => updateForm({ expiredDate: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Warranty Expiry Date</Label>
                      <Input type="date" value={form.warrantyExpiredDate} onChange={(e) => updateForm({ warrantyExpiredDate: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Assigned To</Label>
                      <Select value={form.assignedTo || "none"} onValueChange={(v) => updateForm({ assignedTo: v === "none" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {users.map((u) => <SelectItem key={u._id} value={u._id}>{u.displayName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {form.assetCategory === "Hardware" && (
                      <div className="space-y-2">
                        <Label>Serial Number</Label>
                        <Input value={form.serialNumber} onChange={(e) => updateForm({ serialNumber: e.target.value })} />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Comment</Label>
                    <Textarea value={form.comment} onChange={(e) => updateForm({ comment: e.target.value })} rows={3} />
                  </div>
                </>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><span className="text-muted-foreground">Name</span><p className="font-medium mt-0.5">{asset.name}</p></div>
                    <div><span className="text-muted-foreground">Type</span><p className="font-medium mt-0.5">{asset.assetType}</p></div>
                    <div><span className="text-muted-foreground">Category</span><p className="font-medium mt-0.5">{asset.assetCategory}</p></div>
                    <div><span className="text-muted-foreground">Asset Tag</span><p className="font-mono font-medium mt-0.5">{asset.assetTag}</p></div>
                    {asset.vendor && <div><span className="text-muted-foreground">Vendor</span><p className="font-medium mt-0.5">{asset.vendor}</p></div>}
                    {asset.serialNumber && <div><span className="text-muted-foreground">Serial Number</span><p className="font-mono font-medium mt-0.5">{asset.serialNumber}</p></div>}
                    {asset.purchaseCost != null && <div><span className="text-muted-foreground">Purchase Cost</span><p className="font-medium mt-0.5">${asset.purchaseCost.toLocaleString()}</p></div>}
                    {asset.purchaseDate && <div><span className="text-muted-foreground">Purchase Date</span><p className="font-medium mt-0.5">{formatDate(asset.purchaseDate)}</p></div>}
                    {asset.expiredDate && <div><span className="text-muted-foreground">Expiry Date</span><p className="font-medium mt-0.5">{formatDate(asset.expiredDate)}</p></div>}
                    {asset.warrantyExpiredDate && <div><span className="text-muted-foreground">Warranty Expiry</span><p className="font-medium mt-0.5">{formatDate(asset.warrantyExpiredDate)}</p></div>}
                  </div>
                  {asset.comment && (
                    <>
                      <Separator />
                      <div><span className="text-muted-foreground">Comment</span><p className="mt-1 whitespace-pre-wrap">{asset.comment}</p></div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category-specific details */}
          {asset.assetCategory === "Software" && (
            <Card>
              <CardHeader><CardTitle className="text-base">Software Details</CardTitle></CardHeader>
              <CardContent>
                {editing ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>License Key</Label>
                      <Input value={form.licenseKey} onChange={(e) => updateForm({ licenseKey: e.target.value })} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Total Seats</Label>
                        <Input type="number" value={form.totalSeats} onChange={(e) => updateForm({ totalSeats: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Seats Used</Label>
                        <Input type="number" value={form.seatsUsed} onChange={(e) => updateForm({ seatsUsed: e.target.value })} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 text-sm">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {asset.licenseKey && <div className="sm:col-span-2"><span className="text-muted-foreground">License Key</span><p className="font-mono font-medium mt-0.5">{asset.licenseKey}</p></div>}
                      {asset.totalSeats != null && <div><span className="text-muted-foreground">Total Seats</span><p className="font-medium mt-0.5">{asset.totalSeats}</p></div>}
                      {asset.seatsUsed != null && <div><span className="text-muted-foreground">Seats Used</span><p className="font-medium mt-0.5">{asset.seatsUsed}</p></div>}
                    </div>
                    {asset.totalSeats != null && asset.seatsUsed != null && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Seat usage</span>
                          <span>{asset.seatsUsed} / {asset.totalSeats}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (asset.seatsUsed / asset.totalSeats) * 100)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {asset.assetCategory === "Consumable" && (
            <Card>
              <CardHeader><CardTitle className="text-base">Consumable Details</CardTitle></CardHeader>
              <CardContent>
                {editing ? (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Stock Quantity</Label>
                      <Input type="number" value={form.stockQuantity} onChange={(e) => updateForm({ stockQuantity: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Reorder Threshold</Label>
                      <Input type="number" value={form.reorderThreshold} onChange={(e) => updateForm({ reorderThreshold: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Unit</Label>
                      <Input value={form.unit} onChange={(e) => updateForm({ unit: e.target.value })} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 text-sm">
                    <div className="grid gap-3 sm:grid-cols-3">
                      {asset.stockQuantity != null && (
                        <div>
                          <span className="text-muted-foreground">Stock Quantity</span>
                          <p className={`font-medium mt-0.5 ${asset.reorderThreshold != null && asset.stockQuantity <= asset.reorderThreshold ? "text-red-600" : ""}`}>
                            {asset.stockQuantity} {asset.unit || ""}
                          </p>
                        </div>
                      )}
                      {asset.reorderThreshold != null && <div><span className="text-muted-foreground">Reorder Threshold</span><p className="font-medium mt-0.5">{asset.reorderThreshold} {asset.unit || ""}</p></div>}
                      {asset.unit && <div><span className="text-muted-foreground">Unit</span><p className="font-medium mt-0.5">{asset.unit}</p></div>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Edit action buttons */}
          {editing && (
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleCancel}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Assignment</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">State</p>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ASSET_STATE_COLORS[asset.currentState] || ""}`}>
                  {asset.currentState}
                </span>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Assigned To</p>
                {asset.assignedTo ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{asset.assignedTo.displayName}</span>
                    </div>
                    {asset.assignedTo.email && (
                      <p className="text-xs text-muted-foreground ml-6">{asset.assignedTo.email}</p>
                    )}
                    {asset.assignedTo.department && (
                      <p className="text-xs text-muted-foreground ml-6">{asset.assignedTo.department}</p>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Unassigned</span>
                )}
              </div>

              {asset.department && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Department</p>
                  <p className="text-sm">{asset.department}</p>
                </div>
              )}

              {asset.site && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Site</p>
                  <p className="text-sm">{asset.site.name}</p>
                </div>
              )}

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3 w-3" /> Created {formatDateTime(asset.createdAt)}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3 w-3" /> Updated {formatDateTime(asset.updatedAt)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
