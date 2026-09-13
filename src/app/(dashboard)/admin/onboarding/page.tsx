"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useBrand } from "@/components/providers/brand-provider";
import {
  Building2,
  Users,
  Upload,
  Download,
  Sparkles,
  CheckCircle2,
  Circle,
  ArrowRight,
  ArrowLeft,
  Rocket,
  Palette,
  ImageIcon,
  AppWindow,
  History,
} from "lucide-react";
import {
  canonicalizeDeptRow,
  canonicalizeUserRow,
  parseSpreadsheetFile,
} from "@/lib/parse-spreadsheet";
import { downloadImportTemplate } from "@/lib/download-template";
import { ImportOverlay } from "@/components/ui/import-overlay";
import { DEFAULT_ICON, DEFAULT_LOGO } from "@/lib/public-assets";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState } from "@/components/ui/loading-state";

type Step = 0 | 1 | 2 | 3 | 4;
type ImportKind = "departments" | "users";

interface OnboardingData {
  completed: boolean;
  appearanceReady: boolean;
  departmentsReady: boolean;
  usersReady: boolean;
  departmentCount: number;
  userCount: number;
  nonAdminCount: number;
  needsOnboarding: boolean;
  appName: string;
  logo: string;
  icon: string;
  nameReady: boolean;
  logoReady: boolean;
  iconReady: boolean;
}

interface ImportFailure {
  row: number;
  data?: Record<string, unknown>;
  error: string;
}

interface ImportSummary {
  total: number;
  created: number;
  updated: number;
  failed: number;
}

interface LastImportResult {
  kind: ImportKind;
  fileName: string;
  summary: ImportSummary;
  failures: ImportFailure[];
}

interface ImportHistoryRow {
  _id: string;
  type: ImportKind;
  fileName: string;
  importedByName: string;
  summary: ImportSummary;
  failures: ImportFailure[];
  createdAt: string;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_ACCEPT = ".png,.jpg,.jpeg,.avif,image/png,image/jpeg,image/avif";
const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "avif"]);

function getExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function formatFailureData(data?: Record<string, unknown>): string {
  if (!data || Object.keys(data).length === 0) return "—";
  // Prefer readable key fields first
  const preferred = ["name", "displayName", "username", "email", "department", "employeeId"];
  const parts: string[] = [];
  for (const k of preferred) {
    if (data[k] != null && String(data[k]).trim()) {
      parts.push(`${k}: ${String(data[k])}`);
    }
  }
  if (parts.length > 0) return parts.join(" · ");
  try {
    return JSON.stringify(data);
  } catch {
    return "—";
  }
}

export default function OnboardingPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { refreshBrand } = useBrand();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>(0);
  const [data, setData] = useState<OnboardingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string>("Working…");
  const [busyDetail, setBusyDetail] = useState<string>("");
  const [appNameDraft, setAppNameDraft] = useState("NexusDesk");
  const [uploading, setUploading] = useState<"logo" | "icon" | null>(null);

  // Import result + history (departments & users)
  const [importResultOpen, setImportResultOpen] = useState(false);
  const [lastImport, setLastImport] = useState<LastImportResult | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyKind, setHistoryKind] = useState<ImportKind>("departments");
  const [histories, setHistories] = useState<ImportHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<ImportHistoryRow | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding");
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        if (json.data.appName) setAppNameDraft(json.data.appName);
        if (json.data.completed) {
          router.replace("/");
        }
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function downloadDeptTemplate() {
    try {
      await downloadImportTemplate("department");
    } catch {
      toast({ title: "Failed to download template", variant: "destructive" });
    }
  }

  async function downloadUserTemplate() {
    try {
      await downloadImportTemplate("user");
    } catch {
      toast({ title: "Failed to download template", variant: "destructive" });
    }
  }

  async function generateDepartments() {
    setBusyLabel("Generating departments…");
    setBusyDetail("");
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "departments" }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: json.message || "Departments generated", variant: "success" });
        await refresh();
      } else {
        toast({ title: json.error || "Failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to generate", variant: "destructive" });
    }
    setBusy(false);
  }

  async function generateUsers() {
    setBusyLabel("Generating users…");
    setBusyDetail("");
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "users" }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: json.message || "Users generated", variant: "success" });
        await refresh();
      } else {
        toast({ title: json.error || "Failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to generate", variant: "destructive" });
    }
    setBusy(false);
  }

  function openImportResult(kind: ImportKind, fileName: string, summary: ImportSummary, failures: ImportFailure[]) {
    setLastImport({ kind, fileName, summary, failures: failures || [] });
    setImportResultOpen(true);
  }

  async function openImportHistory(kind: ImportKind) {
    setHistoryKind(kind);
    setSelectedHistory(null);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const endpoint =
        kind === "departments" ? "/api/departments/import?limit=30" : "/api/users/import?limit=30";
      const res = await fetch(endpoint);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setHistories(json.data as ImportHistoryRow[]);
      } else {
        setHistories([]);
      }
    } catch {
      setHistories([]);
      toast({ title: "Failed to load import history", variant: "destructive" });
    }
    setHistoryLoading(false);
  }

  async function viewHistoryDetail(id: string) {
    setHistoryLoading(true);
    try {
      const endpoint =
        historyKind === "departments"
          ? `/api/departments/import?id=${id}`
          : `/api/users/import?id=${id}`;
      const res = await fetch(endpoint);
      const json = await res.json();
      if (json.success && json.data) {
        setSelectedHistory(json.data as ImportHistoryRow);
      } else {
        toast({ title: json.error || "History not found", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to load history detail", variant: "destructive" });
    }
    setHistoryLoading(false);
  }

  async function importDepartments(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusyLabel("Importing departments…");
    setBusyDetail(file.name);
    setBusy(true);
    try {
      const rawRows = await parseSpreadsheetFile(file);
      const payload = rawRows.map((r) => canonicalizeDeptRow(r));
      const res = await fetch("/api/departments/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departments: payload, fileName: file.name, updateExisting: true }),
      });
      const json = await res.json();
      if (json.success) {
        const s = json.data.summary as ImportSummary;
        const failures = (json.data.failures || []) as ImportFailure[];
        toast({
          title: "Departments imported",
          description: `${s.created} created, ${s.updated} updated, ${s.failed} failed of ${s.total}`,
          variant: s.failed > 0 ? "destructive" : "success",
        });
        openImportResult("departments", file.name, s, failures);
        await refresh();
      } else {
        toast({ title: json.error || "Import failed", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Import failed", description: (err as Error).message, variant: "destructive" });
    }
    setBusy(false);
  }

  async function importUsers(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusyLabel("Importing users…");
    setBusyDetail(file.name);
    setBusy(true);
    try {
      const rawRows = await parseSpreadsheetFile(file);
      const usersPayload = rawRows.map((r) => canonicalizeUserRow(r));
      const res = await fetch("/api/users/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users: usersPayload, fileName: file.name, updateExisting: true }),
      });
      const json = await res.json();
      if (json.success) {
        const s = json.data.summary as ImportSummary;
        const failures = (json.data.failures || []) as ImportFailure[];
        toast({
          title: "Users imported",
          description: `${s.created} created, ${s.updated} updated, ${s.failed} failed of ${s.total}`,
          variant: s.failed > 0 ? "destructive" : "success",
        });
        openImportResult("users", file.name, s, failures);
        await refresh();
      } else {
        toast({ title: json.error || "Import failed", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Import failed", description: (err as Error).message, variant: "destructive" });
    }
    setBusy(false);
  }

  function validateImage(file: File): string | null {
    if (file.size <= 0) return "Empty file";
    if (file.size > MAX_IMAGE_BYTES) return "File too large. Maximum size is 5MB.";
    const ext = getExt(file.name);
    if (!IMAGE_EXT.has(ext)) return "Only PNG, JPG, JPEG, and AVIF are allowed.";
    return null;
  }

  async function saveAppName() {
    const name = appNameDraft.trim();
    if (!name) {
      toast({ title: "App name is required", variant: "destructive" });
      return;
    }
    if (name.toLowerCase() === "nexusdesk") {
      toast({
        title: "Choose a custom app name",
        description: "App name cannot stay as the default “NexusDesk”.",
        variant: "destructive",
      });
      return;
    }
    setBusyLabel("Saving app name…");
    setBusyDetail("");
    setBusy(true);
    try {
      // Merge with current appearance so we don't wipe logo/icon
      const curRes = await fetch("/api/settings?key=appearance");
      const curJson = await curRes.json();
      const current = (curJson.data || {}) as Record<string, unknown>;
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "appearance",
          value: {
            ...current,
            appName: name,
            logo: current.logo || DEFAULT_LOGO,
            icon: current.icon || DEFAULT_ICON,
            font: current.font || "Inter",
            fontUrl: current.fontUrl || "",
          },
        }),
      });
      const json = await res.json();
      if (json.success) {
        await refreshBrand();
        await refresh();
        toast({ title: "App name saved", variant: "success" });
      } else {
        toast({ title: json.error || "Failed to save", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to save app name", variant: "destructive" });
    }
    setBusy(false);
  }

  async function uploadImage(kind: "logo" | "icon", file: File) {
    const err = validateImage(file);
    if (err) {
      toast({ title: err, variant: "destructive" });
      return;
    }
    setUploading(kind);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", kind);
      const res = await fetch("/api/brand/upload", { method: "POST", body });
      const json = await res.json();
      if (json.success) {
        await refreshBrand();
        await refresh();
        toast({
          title: kind === "icon" ? "App icon uploaded" : "App logo uploaded",
          variant: "success",
        });
      } else {
        toast({ title: json.error || "Upload failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    setUploading(null);
  }

  async function finish(skipUsers = false) {
    setBusyLabel("Finishing setup…");
    setBusyDetail("");
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: skipUsers ? "skip" : "complete" }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Onboarding complete", variant: "success" });
        router.replace("/");
      } else {
        toast({ title: json.error || "Cannot finish yet", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to complete onboarding", variant: "destructive" });
    }
    setBusy(false);
  }

  if (loading || !data) {
    return <LoadingState label="Loading system onboarding" className="h-64" />;
  }

  const steps = [
    { id: 0, label: "Welcome" },
    { id: 1, label: "Systems Appearance" },
    { id: 2, label: "Departments" },
    { id: 3, label: "Users" },
    { id: 4, label: "Finish" },
  ];

  const stepDone = (id: number) => {
    if (id === 1) return data.appearanceReady;
    if (id === 2) return data.departmentsReady;
    if (id === 3) return data.usersReady;
    return id < step;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <ImportOverlay
        open={busy || uploading !== null}
        kind={uploading !== null ? "image" : "spreadsheet"}
        label={
          uploading === "logo"
            ? "Uploading logo…"
            : uploading === "icon"
              ? "Uploading app icon…"
              : busyLabel
        }
        detail={uploading !== null ? undefined : busyDetail || undefined}
      />
      <PageHeader
        title="System Onboarding"
        description="Fresh install detected. Configure branding, departments, and users before going live."
      />

      <div className="flex flex-wrap gap-2">
        {steps.map((s) => {
          const done = stepDone(s.id);
          const active = step === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id as Step)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : done
                    ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/30 hover:bg-accent hover:text-accent-foreground"
                    : "bg-muted/40 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {done && s.id !== 0 && s.id !== 4 ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Circle className="h-3.5 w-3.5" />
              )}
              {s.label}
            </button>
          );
        })}
      </div>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" /> Welcome, SuperAdmin
            </CardTitle>
            <CardDescription>
              Your system is factory-default. Complete these mandatory setup steps.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>
                <strong>Systems Appearance</strong> — set custom App Name, App Logo, and App Icon
                (required)
              </li>
              <li>
                <strong>Manage Department</strong> — Import CSV/XLSX, Download Template, or Generate
                Recommendation
              </li>
              <li>
                <strong>Manage Users</strong> — Import CSV/XLSX, Download Template, or Generate
                Recommendation
              </li>
            </ol>
            <Button
              className="hover:bg-accent hover:text-accent-foreground"
              onClick={() => setStep(1)}
            >
              Start setup <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" /> Systems Appearance
            </CardTitle>
            <CardDescription>
              Mandatory. Replace default branding: App Name, App Logo (login/navbar), and App Icon
              (browser title / favicon).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border p-3 bg-muted/20 text-sm space-y-1">
              <div className="flex items-center gap-2">
                {data.nameReady ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Circle className="h-4 w-4 text-amber-600" />
                )}
                App Name {data.nameReady ? "— ready" : "— change from default “NexusDesk”"}
              </div>
              <div className="flex items-center gap-2">
                {data.logoReady ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Circle className="h-4 w-4 text-amber-600" />
                )}
                App Logo {data.logoReady ? "— ready" : "— upload a custom logo"}
              </div>
              <div className="flex items-center gap-2">
                {data.iconReady ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Circle className="h-4 w-4 text-amber-600" />
                )}
                App Icon {data.iconReady ? "— ready" : "— upload a custom icon"}
              </div>
            </div>

            <div className="space-y-2">
              <Label>App Name *</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={appNameDraft}
                  onChange={(e) => setAppNameDraft(e.target.value)}
                  placeholder="Your company app name"
                  disabled={busy}
                />
                <Button
                  variant="outline"
                  className="hover:bg-accent hover:text-accent-foreground shrink-0"
                  onClick={saveAppName}
                  disabled={busy}
                >
                  Save name
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Must not remain the default name “NexusDesk”.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" /> App Logo *
              </Label>
              <p className="text-xs text-muted-foreground">
                Login & navbar. PNG, JPG, JPEG, AVIF — max 5MB.
              </p>
              <input
                ref={logoInputRef}
                type="file"
                accept={IMAGE_ACCEPT}
                className="hidden"
                disabled={busy || uploading !== null}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void uploadImage("logo", f);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="hover:bg-accent hover:text-accent-foreground"
                disabled={busy || uploading !== null}
                onClick={() => logoInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading === "logo" ? "Uploading..." : "Upload Logo"}
              </Button>
              <div className="p-3 border rounded-lg bg-muted/30 flex items-center justify-center min-h-[72px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={data.logo}
                  src={data.logo || DEFAULT_LOGO}
                  alt="Logo"
                  className="max-h-14 w-auto object-contain"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <AppWindow className="h-4 w-4" /> App Icon *
              </Label>
              <p className="text-xs text-muted-foreground">
                Browser tab / title favicon. PNG, JPG, JPEG, AVIF — max 5MB.
              </p>
              <input
                ref={iconInputRef}
                type="file"
                accept={IMAGE_ACCEPT}
                className="hidden"
                disabled={busy || uploading !== null}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void uploadImage("icon", f);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="hover:bg-accent hover:text-accent-foreground"
                disabled={busy || uploading !== null}
                onClick={() => iconInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading === "icon" ? "Uploading..." : "Upload Icon"}
              </Button>
              <div className="p-3 border rounded-lg bg-muted/30 flex items-center gap-3 min-h-[64px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={data.icon}
                  src={data.icon || DEFAULT_ICON}
                  alt="Icon"
                  className="h-10 w-10 object-contain rounded"
                />
                <span className="text-sm text-muted-foreground">Title / favicon preview</span>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button
                variant="ghost"
                className="hover:bg-accent hover:text-accent-foreground"
                onClick={() => setStep(0)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button
                className="hover:bg-accent hover:text-accent-foreground"
                onClick={() => setStep(2)}
                disabled={!data.appearanceReady}
              >
                Continue <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Manage Department
            </CardTitle>
            <CardDescription>
              At least one department is required. Departments power user dropdowns and import
              validation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-3 bg-muted/20 text-sm">
              Current departments:{" "}
              <strong className={data.departmentsReady ? "text-emerald-600" : "text-amber-600"}>
                {data.departmentCount}
              </strong>
              {data.departmentsReady ? " — ready" : " — not ready"}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="hover:bg-accent hover:text-accent-foreground"
                onClick={downloadDeptTemplate}
                disabled={busy}
              >
                <Download className="h-4 w-4 mr-2" /> Download Template
              </Button>
              <label className="inline-flex">
                <span className="inline-flex items-center justify-center gap-2 h-9 rounded-md border border-input bg-background px-3 text-sm font-medium cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors">
                  <Upload className="h-4 w-4" /> Import from CSV/XLSX
                </span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.txt"
                  className="hidden"
                  onChange={importDepartments}
                  disabled={busy}
                />
              </label>
              <Button
                variant="outline"
                size="sm"
                className="hover:bg-accent hover:text-accent-foreground"
                onClick={generateDepartments}
                disabled={busy}
              >
                <Sparkles className="h-4 w-4 mr-2" /> Generate Recommendation
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="hover:bg-accent hover:text-accent-foreground"
                onClick={() => openImportHistory("departments")}
                disabled={busy}
              >
                <History className="h-4 w-4 mr-2" /> Import History
              </Button>
            </div>
            {lastImport?.kind === "departments" && lastImport.summary.failed > 0 && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm">
                <p className="font-medium text-red-600 dark:text-red-400">
                  Last import: {lastImport.summary.failed} failed row(s) in {lastImport.fileName}
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 mt-1"
                  onClick={() => setImportResultOpen(true)}
                >
                  View failed rows &amp; causes
                </Button>
              </div>
            )}
            <div className="flex justify-between pt-2">
              <Button
                variant="ghost"
                className="hover:bg-accent hover:text-accent-foreground"
                onClick={() => setStep(1)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button
                className="hover:bg-accent hover:text-accent-foreground"
                onClick={() => setStep(3)}
                disabled={!data.departmentsReady}
              >
                Continue <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Manage Users
            </CardTitle>
            <CardDescription>
              Import or generate team members. Each new user gets a temporary password and must
              change it on first login.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-3 bg-muted/20 text-sm space-y-1">
              <div>
                Active users: <strong>{data.userCount}</strong> (non-admin:{" "}
                <strong className={data.usersReady ? "text-emerald-600" : "text-amber-600"}>
                  {data.nonAdminCount}
                </strong>
                )
              </div>
              <div className="text-xs text-muted-foreground">
                Need at least one non-admin user to finish (or use Skip if you only want SuperAdmin
                for now).
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="hover:bg-accent hover:text-accent-foreground"
                onClick={downloadUserTemplate}
                disabled={busy}
              >
                <Download className="h-4 w-4 mr-2" /> Download Template
              </Button>
              <label className="inline-flex">
                <span className="inline-flex items-center justify-center gap-2 h-9 rounded-md border border-input bg-background px-3 text-sm font-medium cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors">
                  <Upload className="h-4 w-4" /> Import from CSV/XLSX
                </span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.txt"
                  className="hidden"
                  onChange={importUsers}
                  disabled={busy}
                />
              </label>
              <Button
                variant="outline"
                size="sm"
                className="hover:bg-accent hover:text-accent-foreground"
                onClick={generateUsers}
                disabled={busy}
              >
                <Sparkles className="h-4 w-4 mr-2" /> Generate Recommendation
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="hover:bg-accent hover:text-accent-foreground"
                onClick={() => openImportHistory("users")}
                disabled={busy}
              >
                <History className="h-4 w-4 mr-2" /> Import History
              </Button>
            </div>
            {lastImport?.kind === "users" && lastImport.summary.failed > 0 && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm">
                <p className="font-medium text-red-600 dark:text-red-400">
                  Last import: {lastImport.summary.failed} failed row(s) in {lastImport.fileName}
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 mt-1"
                  onClick={() => setImportResultOpen(true)}
                >
                  View failed rows &amp; causes
                </Button>
              </div>
            )}
            <div className="flex justify-between pt-2">
              <Button
                variant="ghost"
                className="hover:bg-accent hover:text-accent-foreground"
                onClick={() => setStep(2)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button
                className="hover:bg-accent hover:text-accent-foreground"
                onClick={() => setStep(4)}
                disabled={!data.departmentsReady || !data.appearanceReady}
              >
                Continue <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Finish onboarding</CardTitle>
            <CardDescription>Confirm setup is ready for production use.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                {data.appearanceReady ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                Systems Appearance (name + logo + icon)
              </li>
              <li className="flex items-center gap-2">
                {data.departmentsReady ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                Departments ({data.departmentCount})
              </li>
              <li className="flex items-center gap-2">
                {data.usersReady ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                Non-admin users ({data.nonAdminCount})
              </li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button
                className="hover:bg-accent hover:text-accent-foreground"
                onClick={() => finish(false)}
                disabled={
                  busy || !data.appearanceReady || !data.departmentsReady || !data.usersReady
                }
              >
                Complete setup
              </Button>
              {data.appearanceReady && data.departmentsReady && !data.usersReady && (
                <Button
                  variant="outline"
                  className="hover:bg-accent hover:text-accent-foreground"
                  onClick={() => finish(true)}
                  disabled={busy}
                >
                  Skip users for now
                </Button>
              )}
              <Button
                variant="ghost"
                className="hover:bg-accent hover:text-accent-foreground"
                onClick={() => setStep(3)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Immediate import result — failed rows + causes */}
      <Dialog open={importResultOpen} onOpenChange={setImportResultOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto w-[calc(100vw-1.5rem)]">
          <DialogHeader>
            <DialogTitle>
              Import Result
              {lastImport ? ` — ${lastImport.kind === "departments" ? "Departments" : "Users"}` : ""}
            </DialogTitle>
            <DialogDescription>
              {lastImport?.fileName} —{" "}
              {lastImport
                ? `${lastImport.summary.created} created, ${lastImport.summary.updated} updated, ${lastImport.summary.failed} failed of ${lastImport.summary.total}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {lastImport && lastImport.failures.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                Failed rows ({lastImport.failures.length}) — row number &amp; error cause
              </p>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Row #</TableHead>
                      <TableHead>Row data</TableHead>
                      <TableHead>Error / cause</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lastImport.failures.map((f) => (
                      <TableRow key={`fail-${f.row}-${f.error}`}>
                        <TableCell className="font-mono font-semibold align-top">{f.row}</TableCell>
                        <TableCell className="text-xs max-w-[280px] align-top">
                          <pre className="whitespace-pre-wrap break-all font-sans">
                            {formatFailureData(f.data)}
                          </pre>
                        </TableCell>
                        <TableCell className="text-sm text-red-600 dark:text-red-400 align-top">
                          {f.error}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">All rows imported successfully.</p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            {lastImport && (
              <Button
                variant="outline"
                onClick={() => {
                  setImportResultOpen(false);
                  void openImportHistory(lastImport.kind);
                }}
              >
                <History className="h-4 w-4 mr-2" /> Open full history
              </Button>
            )}
            <Button onClick={() => setImportResultOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import History list + detail */}
      <Dialog
        open={historyOpen}
        onOpenChange={(o) => {
          setHistoryOpen(o);
          if (!o) setSelectedHistory(null);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[calc(100vw-1.5rem)]">
          <DialogHeader>
            <DialogTitle>
              {historyKind === "departments" ? "Department" : "User"} Import History
            </DialogTitle>
            <DialogDescription>
              Past imports with failed-row details (row #, data, error cause)
            </DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <LoadingState label="Loading import history" className="min-h-32 py-10" />
          ) : selectedHistory ? (
            <div className="space-y-4">
              <Button variant="outline" size="sm" onClick={() => setSelectedHistory(null)}>
                ← Back to list
              </Button>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{selectedHistory.fileName}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {selectedHistory.importedByName} ·{" "}
                    {formatDateTime(selectedHistory.createdAt)} ·{" "}
                    {selectedHistory.summary.created} created, {selectedHistory.summary.updated}{" "}
                    updated, {selectedHistory.summary.failed} failed /{" "}
                    {selectedHistory.summary.total} total
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  {selectedHistory.failures?.length ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-20">Row #</TableHead>
                            <TableHead>Row data</TableHead>
                            <TableHead>Error / cause</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedHistory.failures.map((f, i) => (
                            <TableRow key={`${selectedHistory._id}-f-${f.row}-${i}`}>
                              <TableCell className="font-mono font-semibold align-top">
                                {f.row}
                              </TableCell>
                              <TableCell className="text-xs max-w-[280px] align-top">
                                <pre className="whitespace-pre-wrap break-all font-sans">
                                  {formatFailureData(f.data)}
                                </pre>
                              </TableCell>
                              <TableCell className="text-sm text-red-600 dark:text-red-400 align-top">
                                {f.error}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground p-4">No failed rows.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : histories.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No import history yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead className="text-right">Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {histories.map((h) => (
                    <TableRow key={h._id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDateTime(h.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{h.fileName}</TableCell>
                      <TableCell className="text-sm">{h.importedByName}</TableCell>
                      <TableCell className="text-sm">
                        +{h.summary.created} / ~{h.summary.updated} / ✗{h.summary.failed} of{" "}
                        {h.summary.total}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => viewHistoryDetail(h._id)}
                        >
                          View Status
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
