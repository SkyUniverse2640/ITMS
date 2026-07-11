"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Download, TrendingUp, Clock, Package, Users, DollarSign, ShieldCheck } from "lucide-react";

const COLORS = ["#2563eb", "#22c55e", "#f97316", "#ef4444", "#8b5cf6", "#06b6d4", "#eab308"];

const REPORTS = [
  { id: "ticket-volume", label: "Ticket Volume", icon: TrendingUp },
  { id: "sla-compliance", label: "SLA Compliance", icon: ShieldCheck },
  { id: "resolution-time", label: "Resolution Time", icon: Clock },
  { id: "asset-inventory", label: "Asset Inventory", icon: Package },
  { id: "technician-performance", label: "Technician Performance", icon: Users },
  { id: "purchase-spend", label: "Purchase Spend", icon: DollarSign },
];

export default function ReportsPage() {
  const { toast } = useToast();
  const [activeReport, setActiveReport] = useState("ticket-volume");
  const [days, setDays] = useState("30");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, [activeReport, days]);

  async function loadReport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?type=${activeReport}&days=${days}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {}
    setLoading(false);
  }

  function exportCSV() {
    if (!data) return;
    // Flatten common report arrays into CSV rows when possible
    const rows: string[][] = [];
    const arrays = Object.entries(data).filter(([, v]) => Array.isArray(v));
    if (arrays.length > 0) {
      for (const [key, arr] of arrays) {
        const list = arr as Record<string, unknown>[];
        if (list.length === 0) continue;
        const headers = Object.keys(list[0]);
        rows.push([`# ${key}`]);
        rows.push(headers);
        for (const item of list) {
          rows.push(headers.map((h) => String(item[h] ?? "")));
        }
        rows.push([]);
      }
    }
    let content: string;
    let filename: string;
    let mime: string;
    if (rows.length > 0) {
      content = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      filename = `${activeReport}-${days}days.csv`;
      mime = "text/csv";
    } else {
      content = JSON.stringify(data, null, 2);
      filename = `${activeReport}-${days}days.json`;
      mime = "application/json";
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Report exported", description: filename, variant: "success" });
  }

  function toChartData(arr: { _id: string; count: number }[]) {
    return (arr || []).map((x) => ({ name: x._id || "Unknown", value: x.count }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Analytics and insights</p>
        </div>
        <div className="flex gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" /> Export</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {REPORTS.map((r) => (
          <button
            key={r.id}
            onClick={() => setActiveReport(r.id)}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors ${
              activeReport === r.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
            }`}
          >
            <r.icon className={`h-6 w-6 ${activeReport === r.id ? "text-primary" : "text-muted-foreground"}`} />
            <span className="text-xs text-center font-medium">{r.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : (
        <div className="space-y-6">
          {activeReport === "ticket-volume" && data && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Tickets Over Time</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={(data.byDay as { _id: string; count: number }[])?.map((d) => ({ date: d._id, count: d.count }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">By Priority</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={toChartData(data.byPriority as { _id: string; count: number }[])} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                        {toChartData(data.byPriority as { _id: string; count: number }[]).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">By Status</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={toChartData(data.byStatus as { _id: string; count: number }[])}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">By Category</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={toChartData(data.byCategory as { _id: string; count: number }[])} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {activeReport === "sla-compliance" && data && (
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="md:col-span-1">
                <CardHeader><CardTitle className="text-base">Compliance Rate</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <p className="text-5xl font-bold text-green-600">{data.compliance as number}%</p>
                    <p className="text-sm text-muted-foreground mt-2">SLA Met</p>
                  </div>
                  <Progress value={data.compliance as number} />
                </CardContent>
              </Card>
              <Card><CardContent className="p-6 text-center"><p className="text-sm text-muted-foreground">Total Tickets</p><p className="text-4xl font-bold mt-2">{data.total as number}</p></CardContent></Card>
              <Card><CardContent className="p-6 text-center"><p className="text-sm text-muted-foreground">Breached</p><p className="text-4xl font-bold mt-2 text-red-600">{data.breached as number}</p></CardContent></Card>
            </div>
          )}

          {activeReport === "resolution-time" && data && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">Average Resolution Time</p>
                  <p className="text-5xl font-bold mt-2">{data.averageHours as number}<span className="text-lg text-muted-foreground ml-1">hrs</span></p>
                  <p className="text-sm text-muted-foreground mt-2">{data.totalResolved as number} tickets resolved</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">By Priority</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={Object.entries((data.byPriority as Record<string, { avg: number }>) || {}).map(([k, v]) => ({ name: k, hours: v.avg }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="hours" fill="#f97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {activeReport === "asset-inventory" && data && (
            <div className="grid gap-6 lg:grid-cols-3">
              <Card><CardContent className="p-6 text-center"><p className="text-sm text-muted-foreground">Total Assets</p><p className="text-4xl font-bold mt-2">{data.total as number}</p></CardContent></Card>
              <Card>
                <CardHeader><CardTitle className="text-base">By Category</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={toChartData(data.byType as { _id: string; count: number }[])} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {toChartData(data.byType as { _id: string; count: number }[]).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip /><Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">By State</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={toChartData(data.byState as { _id: string; count: number }[])}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip />
                      <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {activeReport === "technician-performance" && data && (
            <Card>
              <CardHeader><CardTitle className="text-base">Technician Performance</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={(data as unknown as { name: string; total: number; resolved: number }[])}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Legend />
                    <Bar dataKey="total" fill="#94a3b8" name="Total" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="resolved" fill="#22c55e" name="Resolved" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {activeReport === "purchase-spend" && data && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">Total Approved Spend</p>
                  <p className="text-4xl font-bold mt-2">${(data.totalApprovedSpend as number)?.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">By Status</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={(data.byStatus as { _id: string; totalCost: number }[])?.map((s) => ({ name: s._id, cost: s.totalCost }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip />
                      <Bar dataKey="cost" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
