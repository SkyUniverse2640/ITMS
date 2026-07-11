"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, ChevronLeft, ChevronRight, Ticket, AlertTriangle } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { StatusBadge, PriorityBadge } from "@/components/ui/meta-badge";
import { ResizableDataTable, type ResizableDataTableColumn } from "@/components/ui/resizable-data-table";

interface TicketRow {
  _id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
  urgency?: string;
  requestType?: string;
  requesterName: string;
  technician?: { displayName: string };
  slaBreached?: boolean;
  createdAt: string;
}

function RequestsContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const isTechnician = user?.role === "SuperAdmin" || user?.userTypes.includes("Technician");
  const defaultView = isTechnician ? searchParams.get("view") || "assigned" : "my";

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [view, setView] = useState(defaultView);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ assigned: 0, open: 0, closed: 0, breached: 0, mine: 0 });

  useEffect(() => {
    if (user) {
      setView(isTechnician ? searchParams.get("view") || "assigned" : "my");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  useEffect(() => {
    loadTickets();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, view, user?._id]);

  async function loadStats() {
    if (!user) return;
    try {
      if (isTechnician) {
        const [a, o, c] = await Promise.all([
          fetch("/api/tickets?view=assigned&limit=1").then((r) => r.json()),
          fetch("/api/tickets?status=Open&limit=1").then((r) => r.json()),
          fetch("/api/tickets?status=Closed&limit=1").then((r) => r.json()),
        ]);
        setStats((s) => ({
          ...s,
          assigned: a.pagination?.total || 0,
          open: o.pagination?.total || 0,
          closed: c.pagination?.total || 0,
        }));
      } else {
        const m = await fetch("/api/tickets?view=my&limit=1").then((r) => r.json());
        setStats((s) => ({ ...s, mine: m.pagination?.total || 0 }));
      }
    } catch {
      /* ignore */
    }
  }

  async function loadTickets() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);

    if (view === "my") params.set("view", "my");
    else if (view === "assigned") params.set("view", "assigned");
    else if (view === "open") params.set("status", "Open");
    else if (view === "closed") params.set("status", "Closed");
    else if (statusFilter) params.set("status", statusFilter);

    if (statusFilter && view !== "open" && view !== "closed") params.set("status", statusFilter);

    try {
      const res = await fetch(`/api/tickets?${params}`);
      const data = await res.json();
      if (data.success) {
        setTickets(data.data);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
        const breached = (data.data as TicketRow[]).filter((t) => t.slaBreached).length;
        setStats((s) => ({ ...s, breached }));
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    loadTickets();
  }

  const title = isTechnician ? "Requests" : "My Ticket History";
  const subtitle = isTechnician
    ? "Assigned · Open · Closed · SLA Breach tracking"
    : "History of tickets you created";

  return (
    <div className="space-y-6 text-foreground">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm font-semibold text-foreground mt-0.5">{subtitle}</p>
        </div>
        <Link href="/tickets/new">
          <Button>
            <Plus className="h-4 w-4 mr-2 stroke-[2.5]" /> New Request
          </Button>
        </Link>
      </div>

      {isTechnician && (
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["assigned", "Ticket Assigned to Me", stats.assigned],
              ["open", "Open Ticket", stats.open],
              ["closed", "Closed Ticket", stats.closed],
            ] as const
          ).map(([key, label, count]) => (
            <Card
              key={key}
              className={`cursor-pointer transition-shadow hover:shadow-md  ${
                view === key ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => {
                setView(key);
                setPage(1);
                router.replace(`/tickets?view=${key}`);
              }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-foreground">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums text-foreground">{count}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isTechnician && (
        <h2 className="text-base font-bold tracking-tight text-foreground">
          My Ticket History{" "}
          <span className="font-bold text-primary">({stats.mine || total})</span>
        </h2>
      )}

      {isTechnician && (
        <Tabs
          value={view}
          onValueChange={(v) => {
            setView(v);
            setPage(1);
            router.replace(v === "assigned" ? "/tickets?view=assigned" : `/tickets?view=${v}`);
          }}
        >
          <TabsList>
            <TabsTrigger value="assigned">Assigned to Me</TabsTrigger>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="closed">Closed</TabsTrigger>
            <TabsTrigger value="all">All Visible</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <Card className="">
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex flex-1 gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground stroke-[2.5]" />
              <Input
                placeholder="Search tickets..."
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
            <div className="flex items-center justify-center h-48">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Ticket className="h-10 w-10 text-muted-foreground stroke-[2]" />
              <p className="font-semibold text-foreground">No tickets found</p>
              <Link href="/tickets/new">
                <Button variant="outline" size="sm">
                  Create request
                </Button>
              </Link>
            </div>
          ) : (
            <ResizableDataTable
              storageKey="nexusdesk-tickets-table-columns"
              rows={tickets}
              rowKey={(t) => t._id}
              onRowClick={(t) => router.push(`/tickets/${t._id}`)}
              emptyMessage="No tickets found"
              columns={
                [
                  {
                    id: "ticketNumber",
                    label: "Ticket #",
                    width: 120,
                    minWidth: 90,
                    getTooltip: (t) => t.ticketNumber,
                    render: (t) => (
                      <span className="font-mono text-sm font-semibold text-primary">
                        {t.ticketNumber}
                      </span>
                    ),
                  },
                  {
                    id: "subject",
                    label: "Subject",
                    width: 220,
                    minWidth: 120,
                    getTooltip: (t) => t.subject,
                    render: (t) => (
                      <span className="font-semibold text-foreground">{t.subject}</span>
                    ),
                  },
                  {
                    id: "status",
                    label: "Status",
                    width: 120,
                    minWidth: 90,
                    getTooltip: (t) => t.status,
                    render: (t) => <StatusBadge status={t.status} />,
                  },
                  {
                    id: "urgency",
                    label: "Urgency",
                    width: 110,
                    minWidth: 80,
                    getTooltip: (t) => t.urgency || t.priority,
                    render: (t) => <PriorityBadge priority={t.urgency || t.priority} />,
                  },
                  {
                    id: "requester",
                    label: "Requester",
                    width: 140,
                    minWidth: 90,
                    getTooltip: (t) => t.requesterName,
                    render: (t) => (
                      <span className="text-sm font-medium">{t.requesterName}</span>
                    ),
                  },
                  {
                    id: "technician",
                    label: "Technician",
                    width: 140,
                    minWidth: 90,
                    getTooltip: (t) => t.technician?.displayName || "",
                    render: (t) => (
                      <span className="text-sm font-medium">
                        {t.technician?.displayName || "—"}
                      </span>
                    ),
                  },
                  {
                    id: "sla",
                    label: "SLA",
                    width: 100,
                    minWidth: 70,
                    getTooltip: (t) => (t.slaBreached ? "Breach" : "OK"),
                    render: (t) =>
                      t.slaBreached ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400">
                          <AlertTriangle className="h-3.5 w-3.5 stroke-[2.5]" /> Breach
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-green-600 dark:text-green-400">
                          OK
                        </span>
                      ),
                  },
                  {
                    id: "createdAt",
                    label: "Created",
                    width: 150,
                    minWidth: 100,
                    getTooltip: (t) => formatDateTime(t.createdAt),
                    render: (t) => (
                      <span className="text-sm text-muted-foreground">
                        {formatDateTime(t.createdAt)}
                      </span>
                    ),
                  },
                ] as ResizableDataTableColumn<TicketRow>[]
              }
            />
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">
            Page {page} of {totalPages} · {total} total
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4 stroke-[2.5]" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next <ChevronRight className="h-4 w-4 stroke-[2.5]" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TicketsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <RequestsContent />
    </Suspense>
  );
}
