"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/providers/auth-provider";
import { ArrowLeft, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface NamedItem {
  id?: string;
  name: string;
  description?: string;
  department?: string;
}

interface TicketTemplate {
  id?: string;
  _id?: string;
  name: string;
  category: string;
  needApproval?: boolean;
  approvalLabel?: string;
  approver?: string;
  defaultFields?: Record<string, unknown>;
}

function templateKey(t: TicketTemplate) {
  return t.id || t._id || t.name;
}

export default function NewTicketPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [technicians, setTechnicians] = useState<{ _id: string; displayName: string }[]>([]);
  const [myAssets, setMyAssets] = useState<{ _id: string; name: string; assetTag: string }[]>([]);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [templates, setTemplates] = useState<TicketTemplate[]>([]);
  /** Explicit category list (with department) — loaded separately for reliability */
  const [categoryItems, setCategoryItems] = useState<NamedItem[]>([]);
  const [departmentList, setDepartmentList] = useState<string[]>([]);

  const isTechnician =
    user?.role === "SuperAdmin" || !!user?.userTypes?.includes("Technician");

  const [form, setForm] = useState({
    requestType: "Incident",
    status: "Open",
    urgency: "Normal",
    department: "",
    category: "",
    subCategory: "Others", // free-form path = Others; template path = template name
    technician: "",
    project: "",
    subject: "",
    description: "",
    relatedAssets: "",
    templateId: "",
  });

  function names(list: unknown, fallback: string[]): string[] {
    if (!Array.isArray(list) || list.length === 0) return fallback;
    return list
      .map((x) => {
        if (typeof x === "string") return x.trim();
        if (x && typeof x === "object" && "name" in x) {
          return String((x as NamedItem).name || "").trim();
        }
        return "";
      })
      .filter(Boolean);
  }

  /** Normalize group label for comparison (trim + case-insensitive) */
  function norm(s: string | undefined | null): string {
    return (s || "").trim().toLowerCase();
  }

  function parseCategories(raw: unknown, fallbackDept: string): NamedItem[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((x, i) => {
        if (typeof x === "string") {
          return { id: `cat-${i}`, name: x.trim(), department: fallbackDept };
        }
        if (x && typeof x === "object") {
          const o = x as Record<string, unknown>;
          const name = String(o.name || "").trim();
          if (!name) return null;
          const department = String(
            o.department || o.group || o.groupName || o.routedGroup || fallbackDept || ""
          ).trim();
          return {
            id: String(o.id || `cat-${i}`),
            name,
            description: o.description ? String(o.description) : undefined,
            department: department || fallbackDept,
          };
        }
        return null;
      })
      .filter(Boolean) as NamedItem[];
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/users?userType=Technician&limit=100").then((r) => r.json()),
      fetch("/api/assets?view=my&limit=100").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/settings?key=ticketTemplates").then((r) => r.json()).catch(() => ({ data: [] })),
      fetch("/api/settings?key=ticketCategories").then((r) => r.json()).catch(() => ({ data: [] })),
      fetch("/api/settings?key=departments").then((r) => r.json()).catch(() => ({ data: [] })),
    ]).then(([techRes, assetRes, settingsRes, tmplRes, catRes, grpRes]) => {
      setTechnicians(techRes.data || []);
      setMyAssets(assetRes.data || []);
      const all = (settingsRes.data || {}) as Record<string, unknown>;
      setSettings(all);
      setTemplates(Array.isArray(tmplRes.data) ? (tmplRes.data as TicketTemplate[]) : []);

      const deptsFromKey = names(grpRes.data, []);
      const deptsFromAll = names(all.departments, []);
      const deptsResolved =
        deptsFromKey.length > 0
          ? deptsFromKey
          : deptsFromAll.length > 0
            ? deptsFromAll
            : ["IT"];
      setDepartmentList(deptsResolved);

      const fallbackG = deptsResolved[0] || "IT";
      const catsFromKey = parseCategories(catRes.data, fallbackG);
      const catsFromAll = parseCategories(all.ticketCategories, fallbackG);
      // Prefer dedicated key fetch; merge by name if both exist
      const byName = new Map<string, NamedItem>();
      for (const c of [...catsFromAll, ...catsFromKey]) {
        byName.set(c.name, c);
      }
      setCategoryItems(Array.from(byName.values()));
    });
  }, []);

  const requestTypes = names(settings.requestTypes, ["Incident", "Request"]);
  const urgencies = names(settings.urgencies, ["Very Low", "Low", "Normal", "High", "Very High"]);
  const departments = departmentList.length > 0 ? departmentList : names(settings.departments, ["IT"]);

  function departmentForCategory(categoryName: string): string {
    if (!categoryName) return departments[0] || "IT";
    const cat = categoryItems.find((c) => norm(c.name) === norm(categoryName));
    return cat?.department || departments[0] || "IT";
  }

  /** Categories that belong to the currently selected group (flexible match) */
  const categoriesForDepartment = useMemo(() => {
    if (!form.department) return [];
    const g = norm(form.department);
    const matched = categoryItems.filter((c) => norm(c.department) === g);
    if (matched.length > 0) return matched;
    // Fallback: if no group field stored on old categories, show none (don't wrong-map)
    return [];
  }, [categoryItems, form.department]);

  const selectedTemplate: TicketTemplate | null = useMemo(() => {
    if (!form.templateId) return null;
    return templates.find((t) => templateKey(t) === form.templateId) ?? null;
  }, [form.templateId, templates]);

  const fromTemplate = selectedTemplate !== null;
  const tmplFields = selectedTemplate?.defaultFields;
  const tmplLocksSubject = !!(tmplFields?.subject as string | undefined);
  const tmplLocksDescription = !!(tmplFields?.description as string | undefined);
  const tmplNeedsApproval = !!selectedTemplate?.needApproval;

  /** Status: non-technician cannot change; template with approval → Pending Approval */
  const effectiveStatus = useMemo(() => {
    if (tmplNeedsApproval) return "Pending Approval";
    if (!isTechnician) return "Open";
    return form.status || "Open";
  }, [tmplNeedsApproval, isTechnician, form.status]);

  /** Manual path: Group first → Category (filtered) → Sub Category = Others */
  function onDepartmentChange(deptName: string) {
    setForm((f) => ({
      ...f,
      department: deptName,
      category: "",
      subCategory: "Others",
    }));
  }

  function onCategoryChange(categoryName: string) {
    setForm((f) => ({
      ...f,
      category: categoryName,
      // Keep group as selected; category must match group filter
      subCategory: fromTemplate ? f.subCategory : "Others",
    }));
  }

  function applyTemplate(templateId: string) {
    if (!templateId) {
      // Clear template → free form path
      setForm((f) => ({
        ...f,
        templateId: "",
        status: isTechnician ? f.status : "Open",
        subCategory: "Others",
        // keep group if set so user can continue free path
      }));
      return;
    }
    const t = templates.find((x) => templateKey(x) === templateId);
    if (!t) {
      setForm((f) => ({ ...f, templateId }));
      return;
    }
    const d = t.defaultFields || {};
    const category = t.category || "";
    const department = (d.department as string) || departmentForCategory(category);
    setForm((f) => ({
      ...f,
      templateId,
      category,
      requestType: (d.requestType as string) || f.requestType,
      urgency: (d.urgency as string) || f.urgency,
      department,
      subject: (d.subject as string) || f.subject,
      description: (d.description as string) || f.description,
      // Sub Category = Request Template name
      subCategory: t.name,
      project: (d.project as string) || f.project,
      status: t.needApproval ? "Pending Approval" : "Open",
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subject.trim()) {
      toast({ title: "Subject required", variant: "destructive" });
      return;
    }
    if (!form.department) {
      toast({ title: "Department required", description: "Pilih department", variant: "destructive" });
      return;
    }
    if (!form.category) {
      toast({ title: "Category required", description: "Pilih category setelah department", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      // Force status rules (client); API also enforces
      const status = selectedTemplate?.needApproval
        ? "Pending Approval"
        : isTechnician
          ? form.status || "Open"
          : "Open";

      // Sub Category: template name OR "Others"
      const subCategory = fromTemplate
        ? selectedTemplate?.name || form.subCategory
        : form.subCategory || "Others";

      const body: Record<string, unknown> = {
        requestType: form.requestType,
        status,
        urgency: form.urgency,
        priority: form.urgency,
        impact: "Normal",
        department: form.department,
        group: form.department, // legacy field kept in sync
        category: form.category || undefined,
        subCategory,
        project: form.project || undefined,
        subject: form.subject.trim(),
        description: form.description,
        relatedAssets:
          form.relatedAssets && form.relatedAssets !== "none" ? [form.relatedAssets] : [],
        fromTemplate: !!selectedTemplate,
        templateId: form.templateId || undefined,
      };
      if (form.technician && form.technician !== "none") body.technician = form.technician;

      // Approval only from Ticket Template (SuperAdmin configures it there)
      if (selectedTemplate?.needApproval) {
        const approver =
          selectedTemplate.approver ||
          (selectedTemplate.defaultFields?.approver as string | undefined);
        const approvalLabel =
          selectedTemplate.approvalLabel ||
          (selectedTemplate.defaultFields?.approvalLabel as string | undefined);
        if (approver) {
          body.approver = approver;
          if (approvalLabel) body.approvalLabel = approvalLabel;
        }
      }

      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Ticket created", description: data.data.ticketNumber, variant: "success" });
        router.push(`/tickets/${data.data._id}`);
      } else {
        toast({ title: data.error || "Failed to create ticket", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error creating ticket", variant: "destructive" });
    }
    setLoading(false);
  }

  const lockedFieldClass = "bg-muted cursor-not-allowed opacity-90";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/tickets">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Request</h1>
          <p className="text-sm text-muted-foreground">Create a new IT service ticket</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {templates.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Template (optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Select
                value={form.templateId || "none"}
                onValueChange={(v) => applyTemplate(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Start from template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template — fill freely</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={templateKey(t)} value={templateKey(t)}>
                      {t.category ? `${t.category} / ` : ""}
                      {t.name}
                      {t.needApproval ? " (needs approval)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fromTemplate && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Lock className="h-3 w-3" />
                  Field dari template dikunci agar mengikuti template. Kosongkan template untuk edit bebas.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Ticket Header */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Ticket Header</CardTitle>
              {!isTechnician && (
                <Badge variant="outline" className="font-normal text-xs gap-1">
                  <Lock className="h-3 w-3" /> Status dikunci
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  Req Type
                  {fromTemplate && <Lock className="h-3 w-3 text-muted-foreground" />}
                </Label>
                {fromTemplate ? (
                  <Input value={form.requestType} disabled className={lockedFieldClass} />
                ) : (
                  <Select
                    value={form.requestType}
                    onValueChange={(v) => setForm({ ...form, requestType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {requestTypes.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  Status
                  <Lock className="h-3 w-3 text-muted-foreground" />
                </Label>
                <div className="space-y-1">
                  <Input value={effectiveStatus} disabled className={lockedFieldClass} />
                  <p className="text-[11px] text-muted-foreground">
                    {tmplNeedsApproval
                      ? "Template need approval → Pending Approval (locked until Approve → Open)"
                      : "Default Open. Technician mengubah status di ticket detail mengikuti hierarchy."}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  Urgency
                  {fromTemplate && <Lock className="h-3 w-3 text-muted-foreground" />}
                </Label>
                {fromTemplate ? (
                  <Input value={form.urgency} disabled className={lockedFieldClass} />
                ) : (
                  <Select
                    value={form.urgency}
                    onValueChange={(v) => setForm({ ...form, urgency: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {urgencies.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Requester Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Requester Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input value={user?.displayName || ""} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ""} disabled className="bg-muted" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Related Assets</Label>
              <Select
                value={form.relatedAssets || "none"}
                onValueChange={(v) => setForm({ ...form, relatedAssets: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="From My Assets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {myAssets.map((a) => (
                    <SelectItem key={a._id} value={a._id}>
                      {a.assetTag} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Department → Category → Sub Category (template name | Others) */}
            <div className="rounded-lg border p-4 space-y-4 bg-muted/20">
              <p className="text-sm font-medium">
                Routing{" "}
                <span className="text-muted-foreground font-normal text-xs">
                  {fromTemplate
                    ? "· dari template (terkunci)"
                    : "· pilih Department dulu, lalu Category; Sub Category = Others"}
                </span>
              </p>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    Department *
                    {fromTemplate && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </Label>
                  {fromTemplate ? (
                    <Input value={form.department} disabled className={lockedFieldClass} />
                  ) : (
                    <Select
                      value={form.department || undefined}
                      onValueChange={onDepartmentChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="pilih Department dulu" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((g) => (
                          <SelectItem key={g} value={g}>
                            {g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    Category *
                    {fromTemplate && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </Label>
                  {fromTemplate ? (
                    <Input value={form.category} disabled className={lockedFieldClass} />
                  ) : !form.department ? (
                    <Input
                      value=""
                      disabled
                      className={lockedFieldClass}
                      placeholder="pilih Department dulu"
                    />
                  ) : categoriesForDepartment.length === 0 ? (
                    <div className="space-y-1">
                      <Input
                        value=""
                        disabled
                        className={lockedFieldClass}
                        placeholder="Tidak ada category untuk department ini"
                      />
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        {categoryItems.length === 0
                          ? "Belum ada category di sistem. SuperAdmin: Ticket Settings → Category."
                          : `Department "${form.department}" belum punya category. Total category: ${categoryItems.length} (${categoryItems
                              .map((c) => `${c.name}→${c.department || "?"}`)
                              .join(", ")}). Pastikan Department di Category sama persis dengan nama Department.`}
                      </p>
                    </div>
                  ) : (
                    <Select
                      value={form.category || undefined}
                      onValueChange={onCategoryChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoriesForDepartment.map((c) => (
                          <SelectItem key={c.id || c.name} value={c.name}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    Sub Category
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  </Label>
                  <Input
                    value={form.subCategory}
                    disabled
                    className={lockedFieldClass}
                    readOnly
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {fromTemplate
                      ? "Isi otomatis = nama Request Template"
                      : "Tanpa template = Others"}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Technician</Label>
                <Select
                  value={form.technician || "none"}
                  onValueChange={(v) => setForm({ ...form, technician: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Assign technician" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {technicians.map((t) => (
                      <SelectItem key={t._id} value={t._id}>
                        {t.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  Project
                  {fromTemplate && <Lock className="h-3 w-3 text-muted-foreground" />}
                </Label>
                <Input
                  value={form.project}
                  onChange={(e) => !fromTemplate && setForm({ ...form, project: e.target.value })}
                  disabled={fromTemplate}
                  className={cn(fromTemplate && lockedFieldClass)}
                  placeholder="Optional project name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5" htmlFor="ticket-subject">
                Subject *
                {fromTemplate && form.subject && (
                  <Lock className="h-3 w-3 text-muted-foreground" />
                )}
              </Label>
              <Input
                id="ticket-subject"
                value={form.subject}
                onChange={(e) => {
                  if (fromTemplate && tmplLocksSubject) return;
                  setForm({ ...form, subject: e.target.value });
                }}
                disabled={fromTemplate && tmplLocksSubject}
                className={cn(
                  fromTemplate && tmplLocksSubject ? lockedFieldClass : undefined
                )}
                placeholder="Brief summary of the request"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Description
                {fromTemplate && tmplLocksDescription ? (
                  <Lock className="h-3 w-3 text-muted-foreground" />
                ) : null}
              </Label>
              <RichTextEditor
                value={form.description}
                onChange={(html) => {
                  if (fromTemplate && tmplLocksDescription) return;
                  setForm({ ...form, description: html });
                }}
                placeholder="Describe the issue or request in detail..."
                minHeight="200px"
                editable={!(fromTemplate && tmplLocksDescription)}
              />
            </div>

            {/* Approval only configured on Ticket Template (SuperAdmin) */}
            {selectedTemplate?.needApproval && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <p className="font-medium">Template requires approval</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Approver sudah ditetapkan di Request Template
                  {selectedTemplate.approvalLabel ||
                  selectedTemplate.defaultFields?.approvalLabel
                    ? ` (${selectedTemplate.approvalLabel || selectedTemplate.defaultFields?.approvalLabel})`
                    : ""}
                  . Status ticket akan{" "}
                  <span className="font-medium">Pending Approval</span>.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/tickets">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Submit Request"}
          </Button>
        </div>
      </form>
    </div>
  );
}
