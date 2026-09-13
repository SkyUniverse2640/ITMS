"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Package, Cpu, Disc, Box } from "lucide-react";
import { ASSET_STATE_COLORS } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { ResizableDataTable, type ResizableDataTableColumn } from "@/components/ui/resizable-data-table";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState } from "@/components/ui/loading-state";

interface AssetRow {
  _id: string;
  assetTag: string;
  name: string;
  assetCategory: string;
  assetType: string;
  currentState: string;
  serialNumber?: string;
  stockQuantity?: number;
  assignedTo?: { displayName: string };
}

const CAT_META = {
  Hardware: { icon: Cpu, color: "text-white", bg: "bg-blue-600" },
  Software: { icon: Disc, color: "text-white", bg: "bg-purple-600" },
  Consumable: { icon: Box, color: "text-white", bg: "bg-orange-500" },
} as const;

export default function AssetsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isSuperAdmin = user?.role === "SuperAdmin";

  const [category, setCategory] = useState<"Hardware" | "Software" | "Consumable" | "all">("Hardware");
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ Hardware: 0, Software: 0, Consumable: 0 });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, user?._id]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view: "my", limit: "100" });
      if (category !== "all") params.set("category", category);
      if (search) params.set("search", search);

      const res = await fetch(`/api/assets?${params}`);
      const data = await res.json();
      if (data.success) setAssets(data.data);

      const [h, s, c] = await Promise.all([
        fetch("/api/assets?view=my&category=Hardware&limit=1").then((r) => r.json()),
        fetch("/api/assets?view=my&category=Software&limit=1").then((r) => r.json()),
        fetch("/api/assets?view=my&category=Consumable&limit=1").then((r) => r.json()),
      ]);
      setCounts({
        Hardware: h.pagination?.total || 0,
        Software: s.pagination?.total || 0,
        Consumable: c.pagination?.total || 0,
      });
    } catch {
      /* ignore */
    }
    setLoading(false);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    load();
  }

  return (
    <div className="space-y-6 text-foreground">
      <PageHeader
        title="My Assets"
        description="Assets assigned to you — Hardware, Software, Consumable"
        actions={
          isSuperAdmin ? (
            <>
              <Link href="/admin/assets-manage">
                <Button variant="outline">Manage All Assets</Button>
              </Link>
              <Link href="/assets/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> New Asset
                </Button>
              </Link>
            </>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {(["Hardware", "Software", "Consumable"] as const).map((label) => {
          const meta = CAT_META[label];
          const Icon = meta.icon;
          const count = counts[label];
          const selected = category === label;
          return (
            <Card
              key={label}
              className={`cursor-pointer transition-shadow hover:shadow-md  ${
                selected ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => setCategory(label)}
            >
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground">{label}</CardTitle>
                <div className={`rounded-lg p-2 ${meta.bg}`}>
                  <Icon className={`h-4 w-4 stroke-[2.5] ${meta.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums text-foreground">{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs value={category} onValueChange={(v) => setCategory(v as typeof category)}>
        <TabsList>
          <TabsTrigger value="Hardware">Hardware</TabsTrigger>
          <TabsTrigger value="Software">Software</TabsTrigger>
          <TabsTrigger value="Consumable">Consumable</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="">
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground stroke-[2.5]" />
              <Input
                placeholder="Search my assets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 font-medium text-foreground"
              />
            </div>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="">
        <CardContent className="p-0">
          {loading ? (
            <LoadingState label="Loading assets" className="min-h-48" />
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Package className="h-10 w-10 text-muted-foreground stroke-[2]" />
              <p className="font-semibold text-foreground">No {category} assets assigned to you</p>
            </div>
          ) : (
            <ResizableDataTable
              storageKey={`nexusdesk-my-assets-table-${category}`}
              rows={assets}
              rowKey={(a) => a._id}
              onRowClick={(a) => router.push(`/assets/${a._id}`)}
              emptyMessage={`No ${category} assets assigned to you`}
              columns={
                [
                  {
                    id: "assetTag",
                    label: "Asset Tag",
                    width: 130,
                    minWidth: 90,
                    getTooltip: (a) => a.assetTag,
                    render: (a) => (
                      <span className="font-mono text-sm font-semibold text-primary">
                        {a.assetTag}
                      </span>
                    ),
                  },
                  {
                    id: "name",
                    label: "Name",
                    width: 180,
                    minWidth: 100,
                    getTooltip: (a) => a.name,
                    render: (a) => (
                      <span className="font-semibold text-foreground">{a.name}</span>
                    ),
                  },
                  {
                    id: "assetType",
                    label: "Type / Product",
                    width: 140,
                    minWidth: 90,
                    getTooltip: (a) => a.assetType,
                    render: (a) => (
                      <span className="text-sm font-medium">{a.assetType}</span>
                    ),
                  },
                  {
                    id: "currentState",
                    label: "State",
                    width: 120,
                    minWidth: 90,
                    getTooltip: (a) => a.currentState,
                    render: (a) => (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${ASSET_STATE_COLORS[a.currentState] || "bg-slate-500 text-white"}`}
                      >
                        {a.currentState}
                      </span>
                    ),
                  },
                  {
                    id: "extra",
                    label: category === "Consumable" ? "Stock" : "Serial Number",
                    width: 140,
                    minWidth: 90,
                    getTooltip: (a) =>
                      category === "Consumable"
                        ? a.stockQuantity != null
                          ? String(a.stockQuantity)
                          : ""
                        : a.serialNumber || "",
                    render: (a) => (
                      <span className="text-sm font-semibold text-muted-foreground">
                        {category === "Consumable"
                          ? a.stockQuantity != null
                            ? String(a.stockQuantity)
                            : "—"
                          : a.serialNumber || "—"}
                      </span>
                    ),
                  },
                ] as ResizableDataTableColumn<AssetRow>[]
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
