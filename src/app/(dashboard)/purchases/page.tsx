"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Search, ChevronLeft, ChevronRight, Check, X, PackageCheck } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/ui/toast";
import { ResizableDataTable, type ResizableDataTableColumn } from "@/components/ui/resizable-data-table";

const PURCHASE_STATUS_COLORS: Record<string, string> = {
  Draft: "bg-slate-500 text-white dark:bg-slate-500 dark:text-white",
  "Pending Approval": "bg-purple-600 text-white dark:bg-purple-600 dark:text-white",
  Approved: "bg-green-600 text-white dark:bg-green-600 dark:text-white",
  Rejected: "bg-red-600 text-white dark:bg-red-600 dark:text-white",
  Completed: "bg-blue-600 text-white dark:bg-blue-600 dark:text-white",
};

const STATUSES = ["Draft", "Pending Approval", "Approved", "Rejected", "Completed"];
const ASSET_TYPES = ["General", "Hardware", "Software", "Consumable"];

interface UserOption {
  _id: string;
  displayName: string;
}

interface PopulatedUser {
  _id: string;
  displayName: string;
  email?: string;
}

interface PopulatedAsset {
  _id: string;
  name: string;
  assetTag: string;
}

interface PurchaseData {
  _id: string;
  itemName: string;
  linkedAssetType?: string;
  quantity: number;
  estimatedCost: number;
  vendor?: string;
  justification?: string;
  requestedBy: PopulatedUser;
  approver?: PopulatedUser;
  status: string;
  rejectionReason?: string;
  linkedAsset?: PopulatedAsset;
  createdAt: string;
  updatedAt: string;
}

interface PurchaseFormData {
  itemName: string;
  linkedAssetType: string;
  quantity: string;
  estimatedCost: string;
  vendor: string;
  justification: string;
  approver: string;
  status: string;
}

const EMPTY_FORM: PurchaseFormData = {
  itemName: "",
  linkedAssetType: "General",
  quantity: "1",
  estimatedCost: "",
  vendor: "",
  justification: "",
  approver: "",
  status: "Draft",
};

export default function PurchasesPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [purchases, setPurchases] = useState<PurchaseData[]>([]);
  const [approvers, setApprovers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<PurchaseFormData>(EMPTY_FORM);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseData | null>(null);

  const isApprover = user?.userTypes.includes("Approver") ?? false;
  const isSuperAdmin = user?.role === "SuperAdmin";

  const loadPurchases = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (statusFilter) params.set("status", statusFilter);

    try {
      const res = await fetch(`/api/purchases?${params}`);
      const data = await res.json();
      if (data.success) {
        setPurchases(data.data);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
      }
    } catch {
      toast({ title: "Failed to load purchases", variant: "destructive" });
    }
    setLoading(false);
  }, [page, statusFilter, toast]);

  const loadApprovers = useCallback(async () => {
    try {
      const res = await fetch("/api/users?userType=Approver&limit=100");
      const data = await res.json();
      if (data.success) {
        setApprovers(data.data);
      }
    } catch {
      /* silently fail */
    }
  }, []);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  useEffect(() => {
    loadApprovers();
  }, [loadApprovers]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    loadPurchases();
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setCreateOpen(true);
  }

  function openDetail(purchase: PurchaseData) {
    setSelectedPurchase(purchase);
    setDetailOpen(true);
  }

  async function handleCreate() {
    if (!form.itemName.trim()) {
      toast({ title: "Item name is required", variant: "destructive" });
      return;
    }
    const qty = parseInt(form.quantity, 10);
    const cost = parseFloat(form.estimatedCost);
    if (!qty || qty < 1) {
      toast({ title: "Quantity must be at least 1", variant: "destructive" });
      return;
    }
    if (isNaN(cost) || cost < 0) {
      toast({ title: "Estimated cost must be a valid number", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        itemName: form.itemName.trim(),
        linkedAssetType: form.linkedAssetType,
        quantity: qty,
        estimatedCost: cost,
        status: form.status,
      };
      if (form.vendor.trim()) body.vendor = form.vendor.trim();
      if (form.justification.trim()) body.justification = form.justification.trim();
      if (form.approver) body.approver = form.approver;

      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Purchase request created", variant: "success" });
        setCreateOpen(false);
        loadPurchases();
      } else {
        toast({ title: data.error || "Failed to create purchase request", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to create purchase request", variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleApprovalAction(purchaseId: string, action: "approve" | "reject") {
    let rejectionReason = "";
    if (action === "reject") {
      const reason = prompt("Reason for rejection (optional):");
      if (reason === null) return; // cancelled
      rejectionReason = reason;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = { approvalAction: action };
      if (rejectionReason) body.rejectionReason = rejectionReason;

      const res = await fetch(`/api/purchases/${purchaseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: action === "approve" ? "Purchase approved" : "Purchase rejected",
          variant: action === "approve" ? "success" : "default",
        });
        setDetailOpen(false);
        loadPurchases();
      } else {
        toast({ title: data.error || "Failed to process action", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to process action", variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleMarkCompleted(purchaseId: string) {
    if (!confirm("Mark this purchase as completed? This will create an asset from this purchase.")) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/purchases/${purchaseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Completed" }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Purchase marked as completed", variant: "success" });
        setDetailOpen(false);
        loadPurchases();
      } else {
        toast({ title: data.error || "Failed to update", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
    setSaving(false);
  }

  function canApprove(purchase: PurchaseData): boolean {
    if (purchase.status !== "Pending Approval") return false;
    if (isSuperAdmin) return true;
    if (isApprover && purchase.approver?._id === user?._id) return true;
    return false;
  }

  function canComplete(purchase: PurchaseData): boolean {
    return isSuperAdmin && purchase.status === "Approved";
  }

  const filteredPurchases = search
    ? purchases.filter(
        (p) =>
          p.itemName.toLowerCase().includes(search.toLowerCase()) ||
          p.vendor?.toLowerCase().includes(search.toLowerCase()) ||
          p.requestedBy.displayName.toLowerCase().includes(search.toLowerCase())
      )
    : purchases;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Purchases</h1>
          <p className="text-muted-foreground">{total} total purchase requests</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> New Purchase Request
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <form onSubmit={handleSearch} className="flex flex-1 gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search purchases..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="secondary">
                Search
              </Button>
            </form>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filteredPurchases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p>No purchase requests found</p>
            </div>
          ) : (
            <ResizableDataTable
              storageKey="nexusdesk-purchases-table-columns"
              rows={filteredPurchases}
              rowKey={(p) => p._id}
              onRowClick={(p) => openDetail(p)}
              emptyMessage="No purchase requests found"
              actionsWidth={120}
              renderActions={(p) => (
                <div className="flex items-center justify-end gap-1">
                  {canApprove(p) && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-950"
                        onClick={() => handleApprovalAction(p._id, "approve")}
                        disabled={saving}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950"
                        onClick={() => handleApprovalAction(p._id, "reject")}
                        disabled={saving}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {canComplete(p) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950"
                      onClick={() => handleMarkCompleted(p._id)}
                      disabled={saving}
                    >
                      <PackageCheck className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )}
              columns={
                [
                  {
                    id: "itemName",
                    label: "Item Name",
                    width: 180,
                    minWidth: 100,
                    getTooltip: (p) => p.itemName,
                    render: (p) => <span className="font-medium">{p.itemName}</span>,
                  },
                  {
                    id: "quantity",
                    label: "Qty",
                    width: 70,
                    minWidth: 50,
                    getTooltip: (p) => String(p.quantity),
                    render: (p) => p.quantity,
                  },
                  {
                    id: "estimatedCost",
                    label: "Est. Cost",
                    width: 110,
                    minWidth: 80,
                    getTooltip: (p) => `$${p.estimatedCost.toLocaleString()}`,
                    render: (p) => `$${p.estimatedCost.toLocaleString()}`,
                  },
                  {
                    id: "vendor",
                    label: "Vendor",
                    width: 120,
                    minWidth: 80,
                    getTooltip: (p) => p.vendor || "",
                    render: (p) => (
                      <span className="text-sm">{p.vendor || "—"}</span>
                    ),
                  },
                  {
                    id: "requestedBy",
                    label: "Requested By",
                    width: 130,
                    minWidth: 90,
                    getTooltip: (p) => p.requestedBy?.displayName || "",
                    render: (p) => (
                      <span className="text-sm">{p.requestedBy?.displayName || "—"}</span>
                    ),
                  },
                  {
                    id: "approver",
                    label: "Approver",
                    width: 120,
                    minWidth: 80,
                    getTooltip: (p) => p.approver?.displayName || "",
                    render: (p) => (
                      <span className="text-sm">{p.approver?.displayName || "—"}</span>
                    ),
                  },
                  {
                    id: "status",
                    label: "Status",
                    width: 130,
                    minWidth: 90,
                    getTooltip: (p) => p.status,
                    render: (p) => (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PURCHASE_STATUS_COLORS[p.status] || ""}`}
                      >
                        {p.status}
                      </span>
                    ),
                  },
                  {
                    id: "createdAt",
                    label: "Created",
                    width: 140,
                    minWidth: 100,
                    getTooltip: (p) => formatDateTime(p.createdAt),
                    render: (p) => (
                      <span className="text-sm text-muted-foreground">
                        {formatDateTime(p.createdAt)}
                      </span>
                    ),
                  },
                ] as ResizableDataTableColumn<PurchaseData>[]
              }
            />
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create Purchase Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Purchase Request</DialogTitle>
            <DialogDescription>Submit a new purchase request for approval.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="purchase-item">Item Name *</Label>
              <Input
                id="purchase-item"
                value={form.itemName}
                onChange={(e) => setForm((prev) => ({ ...prev, itemName: e.target.value }))}
                placeholder="e.g. Dell Latitude 5540 Laptop"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Asset Type</Label>
                <Select
                  value={form.linkedAssetType}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, linkedAssetType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="purchase-qty">Quantity *</Label>
                <Input
                  id="purchase-qty"
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="purchase-cost">Estimated Cost ($) *</Label>
                <Input
                  id="purchase-cost"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.estimatedCost}
                  onChange={(e) => setForm((prev) => ({ ...prev, estimatedCost: e.target.value }))}
                  placeholder="0.00"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="purchase-vendor">Vendor</Label>
                <Input
                  id="purchase-vendor"
                  value={form.vendor}
                  onChange={(e) => setForm((prev) => ({ ...prev, vendor: e.target.value }))}
                  placeholder="e.g. Dell"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="purchase-justification">Justification</Label>
              <Textarea
                id="purchase-justification"
                value={form.justification}
                onChange={(e) => setForm((prev) => ({ ...prev, justification: e.target.value }))}
                placeholder="Why is this purchase needed?"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Approver</Label>
                <Select
                  value={form.approver}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, approver: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select approver" />
                  </SelectTrigger>
                  <SelectContent>
                    {approvers.map((a) => (
                      <SelectItem key={a._id} value={a._id}>
                        {a.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Submit as</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedPurchase && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedPurchase.itemName}</DialogTitle>
                <DialogDescription>Purchase request details</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${PURCHASE_STATUS_COLORS[selectedPurchase.status] || ""}`}
                  >
                    {selectedPurchase.status}
                  </span>
                  {selectedPurchase.linkedAssetType && (
                    <Badge variant="outline">{selectedPurchase.linkedAssetType}</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                  <div>
                    <p className="text-muted-foreground">Quantity</p>
                    <p className="font-medium">{selectedPurchase.quantity}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Estimated Cost</p>
                    <p className="font-medium">${selectedPurchase.estimatedCost.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Vendor</p>
                    <p className="font-medium">{selectedPurchase.vendor || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Requested By</p>
                    <p className="font-medium">{selectedPurchase.requestedBy?.displayName || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Approver</p>
                    <p className="font-medium">{selectedPurchase.approver?.displayName || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Created</p>
                    <p className="font-medium">{formatDateTime(selectedPurchase.createdAt)}</p>
                  </div>
                </div>

                {selectedPurchase.justification && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Justification</p>
                      <p className="text-sm">{selectedPurchase.justification}</p>
                    </div>
                  </>
                )}

                {selectedPurchase.rejectionReason && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Rejection Reason</p>
                      <p className="text-sm text-red-600 dark:text-red-400">{selectedPurchase.rejectionReason}</p>
                    </div>
                  </>
                )}

                {selectedPurchase.linkedAsset && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Linked Asset</p>
                      <p className="text-sm font-medium">
                        {selectedPurchase.linkedAsset.name} ({selectedPurchase.linkedAsset.assetTag})
                      </p>
                    </div>
                  </>
                )}
              </div>

              <DialogFooter>
                {canApprove(selectedPurchase) && (
                  <div className="flex gap-2 mr-auto">
                    <Button
                      variant="outline"
                      className="text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950"
                      onClick={() => handleApprovalAction(selectedPurchase._id, "approve")}
                      disabled={saving}
                    >
                      <Check className="h-4 w-4 mr-1" /> Approve
                    </Button>
                    <Button
                      variant="outline"
                      className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950"
                      onClick={() => handleApprovalAction(selectedPurchase._id, "reject")}
                      disabled={saving}
                    >
                      <X className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                )}
                {canComplete(selectedPurchase) && (
                  <Button
                    className="mr-auto"
                    variant="outline"
                    onClick={() => handleMarkCompleted(selectedPurchase._id)}
                    disabled={saving}
                  >
                    <PackageCheck className="h-4 w-4 mr-1" /> Mark as Completed
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDetailOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
