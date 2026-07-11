"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/ui/toast";
import {
  Ticket,
  Package,
  ListTodo,
  ShoppingCart,
  Plus,
  ArrowRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Circle,
  ChevronDown,
  LayoutDashboard,
  Star,
  Shield,
  Construction,
  Users,
  Building2,
  Settings2,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { StatusBadge, PriorityBadge } from "@/components/ui/meta-badge";
import type { DashboardKey } from "@/lib/dashboards";
import { cn } from "@/lib/utils";

interface TicketRow {
  _id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
}

interface TaskRow {
  _id: string;
  title: string;
  status: string;
  dueDate?: string;
  priority?: string;
}

interface DashboardListItem {
  key: string;
  name: string;
  description?: string;
  audience: string;
  scope: string;
  isSystemFavorite?: boolean;
  isFavorite?: boolean;
  isActiveDefault?: boolean;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeKey, setActiveKey] = useState<DashboardKey>("general");
  const [dashboards, setDashboards] = useState<DashboardListItem[]>([]);
  const [defaultKey, setDefaultKey] = useState<string>("general");
  const [devWarningOpen, setDevWarningOpen] = useState(false);

  const [stats, setStats] = useState({
    tickets: 0,
    assets: 0,
    tasks: 0,
    purchases: 0,
    openTickets: 0,
    myAssigned: 0,
  });
  const [adminStats, setAdminStats] = useState({
    users: 0,
    departments: 0,
    tickets: 0,
    openTickets: 0,
    assets: 0,
    purchases: 0,
  });
  const [recentTickets, setRecentTickets] = useState<TicketRow[]>([]);
  const [myTasks, setMyTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);

  const isSuperAdmin = user?.role === "SuperAdmin";
  const isTechnician = user?.userTypes.includes("Technician") || isSuperAdmin;
  const isRequester = user?.userTypes.includes("Requester") || isSuperAdmin;

  const loadDashboardList = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      const data = await res.json();
      if (data.success && data.data) {
        setDashboards(data.data.dashboards || []);
        const fav = data.data.defaultDashboardKey || "general";
        setDefaultKey(fav);
        setActiveKey(fav);
      }
    } catch {
      /* defaults */
      setDashboards([
        {
          key: "general",
          name: "General Dashboard",
          audience: "all",
          scope: "system",
          isSystemFavorite: true,
          isFavorite: true,
        },
      ]);
    }
    setListLoading(false);
  }, []);

  useEffect(() => {
    if (user) void loadDashboardList();
  }, [user?._id, loadDashboardList]);

  useEffect(() => {
    if (user && !listLoading) {
      if (activeKey === "admin" && isSuperAdmin) {
        void loadAdminDashboard();
      } else {
        void loadGeneralDashboard();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, activeKey, listLoading]);

  async function loadGeneralDashboard() {
    setLoading(true);
    try {
      const [ticketRes, assignedRes, openRes, taskRes, assetRes, purchaseRes] = await Promise.all([
        fetch("/api/tickets?limit=5&view=my").then((r) => r.json()),
        isTechnician
          ? fetch("/api/tickets?limit=1&view=assigned").then((r) => r.json())
          : Promise.resolve({ pagination: { total: 0 } }),
        fetch("/api/tickets?limit=1&status=Open").then((r) => r.json()),
        fetch("/api/tasks?view=my&limit=5").then((r) => r.json()),
        fetch("/api/assets?limit=1").then((r) => r.json()),
        fetch("/api/purchases?limit=1").then((r) => r.json()),
      ]);

      setRecentTickets(ticketRes.data || []);
      setMyTasks(taskRes.data || []);
      setStats({
        tickets: ticketRes.pagination?.total || 0,
        assets: assetRes.pagination?.total || 0,
        tasks: taskRes.pagination?.total || 0,
        purchases: purchaseRes.pagination?.total || 0,
        openTickets: openRes.pagination?.total || 0,
        myAssigned: assignedRes.pagination?.total || 0,
      });
    } catch {
      /* ignore */
    }
    setLoading(false);
  }

  async function loadAdminDashboard() {
    setLoading(true);
    try {
      const [usersRes, deptsRes, ticketsRes, openRes, assetsRes, purchasesRes] = await Promise.all([
        fetch("/api/users?limit=1").then((r) => r.json()),
        fetch("/api/settings?key=departments").then((r) => r.json()),
        fetch("/api/tickets?limit=1").then((r) => r.json()),
        fetch("/api/tickets?limit=1&status=Open").then((r) => r.json()),
        fetch("/api/assets?limit=1").then((r) => r.json()),
        fetch("/api/purchases?limit=1").then((r) => r.json()),
      ]);
      const deptCount = Array.isArray(deptsRes.data) ? deptsRes.data.length : 0;
      setAdminStats({
        users: usersRes.pagination?.total || 0,
        departments: deptCount,
        tickets: ticketsRes.pagination?.total || 0,
        openTickets: openRes.pagination?.total || 0,
        assets: assetsRes.pagination?.total || 0,
        purchases: purchasesRes.pagination?.total || 0,
      });
      // Recent tickets system-wide for admin
      const recent = await fetch("/api/tickets?limit=5").then((r) => r.json());
      setRecentTickets(recent.data || []);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }

  async function setAsFavorite(key: string) {
    try {
      const res = await fetch("/api/dashboard", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultDashboardKey: key }),
      });
      const data = await res.json();
      if (data.success) {
        setDefaultKey(key);
        setDashboards((prev) =>
          prev.map((d) => ({
            ...d,
            isFavorite: d.key === key,
            isActiveDefault: d.key === key,
          }))
        );
        toast({
          title: "Favorite dashboard updated",
          description: "This dashboard is now your default on login.",
          variant: "success",
        });
      } else {
        toast({ title: data.error || "Failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to set favorite", variant: "destructive" });
    }
  }

  const activeMeta =
    dashboards.find((d) => d.key === activeKey) ||
    ({ key: "general", name: "General Dashboard" } as DashboardListItem);

  const generalStatCards = [
    {
      label: isRequester && !isTechnician ? "My Tickets" : "Tickets",
      value: isTechnician ? stats.openTickets : stats.tickets,
      sub: isTechnician ? "Open" : "Total visible",
      icon: Ticket,
      href: "/tickets",
      tile: "stat-icon-tile stat-icon-blue",
    },
    ...(isTechnician
      ? [
          {
            label: "Assigned to Me",
            value: stats.myAssigned,
            sub: "Active queue",
            icon: Ticket,
            href: "/tickets?view=assigned",
            tile: "stat-icon-tile stat-icon-indigo",
          },
        ]
      : []),
    {
      label: "Assets",
      value: stats.assets,
      sub: "Inventory",
      icon: Package,
      href: "/assets",
      tile: "stat-icon-tile stat-icon-green",
    },
    {
      label: "My Tasks",
      value: stats.tasks,
      sub: "Assigned",
      icon: ListTodo,
      href: "/tasks",
      tile: "stat-icon-tile stat-icon-orange",
    },
    {
      label: "Purchases",
      value: stats.purchases,
      sub: "Requests",
      icon: ShoppingCart,
      href: "/purchases",
      tile: "stat-icon-tile stat-icon-purple",
    },
  ];

  const adminStatCards = [
    {
      label: "Users",
      value: adminStats.users,
      sub: "Active accounts",
      icon: Users,
      href: "/admin/users",
      tile: "stat-icon-tile stat-icon-blue",
    },
    {
      label: "Departments",
      value: adminStats.departments,
      sub: "Org units",
      icon: Building2,
      href: "/admin/departments",
      tile: "stat-icon-tile stat-icon-indigo",
    },
    {
      label: "All Tickets",
      value: adminStats.tickets,
      sub: `${adminStats.openTickets} open`,
      icon: Ticket,
      href: "/tickets",
      tile: "stat-icon-tile stat-icon-orange",
    },
    {
      label: "Assets",
      value: adminStats.assets,
      sub: "Inventory",
      icon: Package,
      href: "/admin/assets-manage",
      tile: "stat-icon-tile stat-icon-green",
    },
    {
      label: "Purchases",
      value: adminStats.purchases,
      sub: "Requests",
      icon: ShoppingCart,
      href: "/purchases",
      tile: "stat-icon-tile stat-icon-purple",
    },
    {
      label: "Settings",
      value: "—",
      sub: "System config",
      icon: Settings2,
      href: "/admin",
      tile: "stat-icon-tile stat-icon-blue",
    },
  ];

  const showAdmin = activeKey === "admin" && isSuperAdmin;
  const cards = showAdmin ? adminStatCards : generalStatCards;

  if (listLoading && !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-foreground">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {/* Dashboard title + switcher dropdown */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="group inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 -ml-1.5 text-left hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <LayoutDashboard className="h-6 w-6 text-primary shrink-0" />
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    {activeMeta.name || "Dashboard"}
                  </h1>
                  <ChevronDown className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                  Available dashboards
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {dashboards.map((d) => (
                  <DropdownMenuItem
                    key={d.key}
                    className="flex flex-col items-start gap-0.5 py-2 cursor-pointer"
                    onClick={() => setActiveKey(d.key)}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="font-semibold flex items-center gap-1.5">
                        {d.key === "admin" ? (
                          <Shield className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <LayoutDashboard className="h-3.5 w-3.5 text-primary" />
                        )}
                        {d.name}
                      </span>
                      <span className="flex items-center gap-1">
                        {d.key === defaultKey && (
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                        )}
                        {activeKey === d.key && (
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                            Active
                          </Badge>
                        )}
                      </span>
                    </div>
                    {d.description && (
                      <span className="text-xs text-muted-foreground pl-5 line-clamp-2">
                        {d.description}
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer opacity-80"
                  onClick={() => setDevWarningOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Dashboard
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    Soon
                  </Badge>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
            <span>Welcome back, {user?.displayName}</span>
            {user?.userTypes?.length
              ? user.userTypes.map((t) => (
                  <Badge key={t} variant="outline" className="font-semibold">
                    {t}
                  </Badge>
                ))
              : null}
            {defaultKey === activeKey && (
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-semibold">
                <Star className="h-3 w-3 mr-1 fill-current" /> Favorite default
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeKey !== defaultKey && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAsFavorite(activeKey)}
              title="Set as your default dashboard"
            >
              <Star className="h-4 w-4 mr-1.5" /> Set as Favorite
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDevWarningOpen(true)}
            className="opacity-90"
          >
            <Plus className="h-4 w-4 mr-1.5" /> New Dashboard
          </Button>
          <Link href="/tickets/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2 stroke-[2.5]" /> New Ticket
            </Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {cards.slice(0, showAdmin ? 6 : 4).map((s) => (
              <Link key={s.label + s.href} href={s.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{s.label}</p>
                        <p
                          className={cn(
                            "text-3xl font-bold mt-1 tabular-nums text-foreground",
                            typeof s.value === "string" && "text-2xl"
                          )}
                        >
                          {s.value}
                        </p>
                        <p className="text-xs font-semibold text-muted-foreground mt-1">{s.sub}</p>
                      </div>
                      <div className={`rounded-xl p-2.5 ${s.tile}`}>
                        <s.icon className="h-5 w-5 stroke-[2.5] text-white" aria-hidden />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {showAdmin ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  System recent tickets
                </CardTitle>
                <Link href="/tickets">
                  <Button variant="ghost" size="sm" className="font-semibold">
                    View All <ArrowRight className="h-4 w-4 ml-1 stroke-[2.5]" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {recentTickets.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No tickets yet</p>
                ) : (
                  <div className="space-y-1">
                    {recentTickets.map((t) => (
                      <Link
                        key={t._id}
                        href={`/tickets/${t._id}`}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-semibold text-primary">
                              {t.ticketNumber}
                            </span>
                            <StatusBadge status={t.status} />
                          </div>
                          <p className="text-sm font-semibold truncate mt-1 text-foreground">
                            {t.subject}
                          </p>
                        </div>
                        <PriorityBadge priority={t.priority} className="shrink-0" />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base font-bold text-foreground">
                    {isTechnician ? "Recent Tickets" : "My Ticket History"}
                  </CardTitle>
                  <Link href="/tickets">
                    <Button variant="ghost" size="sm" className="font-semibold">
                      View All <ArrowRight className="h-4 w-4 ml-1 stroke-[2.5]" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {recentTickets.length === 0 ? (
                    <div
                      className="flex flex-col items-center justify-center py-10 gap-2 text-foreground select-none"
                      contentEditable={false}
                      suppressContentEditableWarning
                    >
                      <Ticket className="h-8 w-8 stroke-[2]" aria-hidden />
                      <p className="text-sm font-semibold cursor-default">No tickets yet</p>
                      <Link href="/tickets/new">
                        <Button variant="outline" size="sm">
                          Create first ticket
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {recentTickets.map((t) => (
                        <Link
                          key={t._id}
                          href={`/tickets/${t._id}`}
                          className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono font-semibold text-primary">
                                {t.ticketNumber}
                              </span>
                              <StatusBadge status={t.status} />
                            </div>
                            <p className="text-sm font-semibold truncate mt-1 text-foreground">
                              {t.subject}
                            </p>
                          </div>
                          <PriorityBadge priority={t.priority} className="shrink-0" />
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base font-bold text-foreground">My Tasks</CardTitle>
                  <Link href="/tasks">
                    <Button variant="ghost" size="sm" className="font-semibold">
                      View All <ArrowRight className="h-4 w-4 ml-1 stroke-[2.5]" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {myTasks.length === 0 ? (
                    <div
                      className="flex flex-col items-center justify-center py-10 gap-2 text-foreground select-none"
                      contentEditable={false}
                      suppressContentEditableWarning
                    >
                      <ListTodo className="h-8 w-8 stroke-[2]" aria-hidden />
                      <p className="text-sm font-semibold cursor-default">No tasks assigned</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {myTasks.map((t) => (
                        <div
                          key={t._id}
                          className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-accent"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {t.status === "Done" ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 stroke-[2.5]" />
                            ) : t.status === "In Progress" ? (
                              <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 stroke-[2.5]" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground shrink-0 stroke-[2.5]" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate text-foreground">
                                {t.title}
                              </p>
                              {t.dueDate ? (
                                <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 flex items-center gap-1 mt-0.5">
                                  <AlertTriangle className="h-3 w-3 stroke-[2.5]" />
                                  Due {formatDate(t.dueDate)}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <Badge
                            variant={t.status === "Done" ? "default" : "secondary"}
                            className="shrink-0 font-semibold"
                          >
                            {t.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Create New Dashboard — development overlay */}
      <Dialog open={devWarningOpen} onOpenChange={setDevWarningOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Construction className="h-5 w-5 text-amber-500" />
              Fitur Dalam Pengembangan
            </DialogTitle>
            <DialogDescription className="text-base pt-2 text-foreground/90">
              <strong className="block text-lg mb-2">Fitur Ini Dalam Tahap Pengembangan</strong>
              Create New Dashboard untuk setiap User Type akan tersedia di update berikutnya.
              Saat ini gunakan <strong>General Dashboard</strong>
              {isSuperAdmin ? (
                <>
                  {" "}
                  atau <strong>Admin Dashboard</strong>
                </>
              ) : null}
              .
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setDevWarningOpen(false)}>Mengerti</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
