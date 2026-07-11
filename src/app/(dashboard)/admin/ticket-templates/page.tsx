"use client";

/**
 * Ticket Template (Category stays HERE only — not Ticket Settings)
 * Flow: Category (linked to Department) → Request Templates per category
 */

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Plus, FileStack, Search, Users } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { RowSettingsMenu } from "@/components/ui/row-settings-menu";
import { DEPT_ROLE_LABELS, type DeptRoleLabel } from "@/lib/department-roles";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  description?: string;
  /** Routes to department (from Manage Department) */
  department: string;
  /** Users who handle / receive notifications for tickets in this category */
  members?: string[];
}

interface UserOption {
  _id: string;
  displayName: string;
  email: string;
  department?: string;
}

interface Template {
  id: string;
  name: string;
  category: string;
  description?: string;
  needApproval: boolean;
  approvalLabel?: DeptRoleLabel;
  approver?: string;
  defaultFields: {
    requestType?: string;
    urgency?: string;
    department?: string;
    subject?: string;
    description?: string;
    project?: string;
    approver?: string;
    approvalLabel?: string;
  };
}

const EMPTY_CAT_FORM = {
  name: "",
  description: "",
  department: "",
  members: [] as string[],
};

export default function TicketTemplatesPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [departments, setDepartments] = useState<{ id?: string; name: string }[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [approverOptions, setApproverOptions] = useState<
    { _id: string; displayName: string; email?: string }[]
  >([]);
  const [loadingApprovers, setLoadingApprovers] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [catOpen, setCatOpen] = useState(false);
  const [catForm, setCatForm] = useState(EMPTY_CAT_FORM);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSearchApplied, setMemberSearchApplied] = useState("");

  const [tmplOpen, setTmplOpen] = useState(false);
  const [editingTmpl, setEditingTmpl] = useState<Template | null>(null);
  const [tmplForm, setTmplForm] = useState({
    name: "",
    description: "",
    needApproval: false,
    approvalLabel: "" as "" | DeptRoleLabel,
    approver: "",
    requestType: "Request",
    urgency: "Normal",
    department: "",
    subject: "",
    body: "",
    project: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  // Load people for selected department + approval label (from Manage Department roles)
  useEffect(() => {
    if (!tmplOpen || !tmplForm.needApproval || !tmplForm.department || !tmplForm.approvalLabel) {
      setApproverOptions([]);
      return;
    }
    let cancelled = false;
    setLoadingApprovers(true);
    fetch(
      `/api/departments/people?department=${encodeURIComponent(tmplForm.department)}&label=${encodeURIComponent(tmplForm.approvalLabel)}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.success && Array.isArray(d.data?.people)) {
          setApproverOptions(d.data.people);
        } else {
          setApproverOptions([]);
        }
      })
      .catch(() => {
        if (!cancelled) setApproverOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingApprovers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tmplOpen, tmplForm.needApproval, tmplForm.department, tmplForm.approvalLabel]);

  async function load() {
    setLoading(true);
    const [c, t, g, u] = await Promise.all([
      fetch("/api/settings?key=ticketCategories").then((r) => r.json()).catch(() => ({ data: null })),
      fetch("/api/settings?key=ticketTemplates").then((r) => r.json()).catch(() => ({ data: null })),
      fetch("/api/settings?key=departments").then((r) => r.json()).catch(() => ({ data: null })),
      fetch("/api/users?limit=500").then((r) => r.json()).catch(() => ({ data: [] })),
    ]);

    // Accept array from settings; also handle { value: [...] } if API shape differs
    const deptRaw = Array.isArray(g?.data)
      ? g.data
      : Array.isArray((g as { data?: { value?: unknown } })?.data?.value)
        ? (g as { data: { value: unknown[] } }).data.value
        : [];
    const departmentList = (deptRaw as unknown[]).map((x, i) => {
      if (typeof x === "string") return { name: x, id: `dept-${i}` };
      if (x && typeof x === "object" && "name" in x) {
        const o = x as { id?: string; name: string };
        return { id: o.id || `dept-${i}`, name: String(o.name || "").trim() };
      }
      return null;
    }).filter((x): x is { id: string; name: string } => !!x && !!x.name);
    setDepartments(departmentList);
    const defaultDepartment = departmentList[0]?.name || "IT";

    if (u?.success && Array.isArray(u.data)) {
      setAllUsers(
        u.data.map((x: UserOption) => ({
          _id: x._id,
          displayName: x.displayName,
          email: x.email,
          department: x.department,
        }))
      );
    } else {
      setAllUsers([]);
    }

    const rawCats: (Category & { group?: string })[] = c.data || [];
    const cats: Category[] = rawCats.map((x, i) => ({
      id: x.id || `cat-${x.name || i}`,
      name: x.name,
      description: x.description,
      department:
        (x.department && String(x.department).trim()) ||
        (x.group && String(x.group).trim()) ||
        defaultDepartment,
      members: Array.isArray(x.members) ? x.members.map(String).filter(Boolean) : [],
    }));

    // Auto-repair missing department field
    if (rawCats.some((x) => !x.department || !String(x.department).trim())) {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "ticketCategories", value: cats }),
      });
    }

    const tmpls: Template[] = (t.data || []).map((x: Template, i: number) => ({
      ...x,
      id: x.id || `tmpl-${i}`,
      defaultFields: x.defaultFields || {},
    }));

    setCategories(cats);
    setTemplates(tmpls);
    if (!activeCategory && cats[0]) setActiveCategory(cats[0].name);
    setLoading(false);
  }

  function resetMemberPicker() {
    setMemberSearch("");
    setMemberSearchApplied("");
  }

  function toggleMember(userId: string) {
    setCatForm((prev) => ({
      ...prev,
      members: prev.members.includes(userId)
        ? prev.members.filter((id) => id !== userId)
        : [...prev.members, userId],
    }));
  }

  function selectAllMembers(userIds: string[], select: boolean) {
    setCatForm((prev) => {
      const set = new Set(prev.members);
      if (select) {
        for (const id of userIds) set.add(id);
      } else {
        for (const id of userIds) set.delete(id);
      }
      return { ...prev, members: [...set] };
    });
  }

  /** Only users whose department matches Route to Department */
  const deptUsers = useMemo(() => {
    const dept = (catForm.department || "").trim().toLowerCase();
    if (!dept) return [];
    return allUsers
      .filter((u) => (u.department || "").trim().toLowerCase() === dept)
      .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
  }, [allUsers, catForm.department]);

  const filteredDeptUsers = useMemo(() => {
    const q = memberSearchApplied.trim().toLowerCase();
    if (!q) return deptUsers;
    return deptUsers.filter(
      (u) =>
        (u.displayName || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q)
    );
  }, [deptUsers, memberSearchApplied]);

  async function saveCategories(next: Category[]) {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "ticketCategories", value: next }),
    });
    setCategories(next);
  }

  async function saveTemplates(next: Template[]) {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "ticketTemplates", value: next }),
    });
    setTemplates(next);
  }

  function departmentForCategory(categoryName: string) {
    return (
      categories.find((c) => c.name === categoryName)?.department ||
      departments[0]?.name ||
      "IT"
    );
  }

  function openEditCategory(c: Category) {
    setEditingCat(c);
    resetMemberPicker();
    setCatForm({
      name: c.name,
      description: c.description || "",
      department: c.department || departments[0]?.name || "",
      members: [...(c.members || [])],
    });
    setCatOpen(true);
  }

  function openNewCategory() {
    setEditingCat(null);
    resetMemberPicker();
    const defaultDept = departments[0]?.name || "";
    setCatForm({
      ...EMPTY_CAT_FORM,
      department: defaultDept,
      members: [],
    });
    setCatOpen(true);
  }

  function onCategoryDepartmentChange(deptName: string) {
    // Switching route department clears handlers from other departments
    setCatForm((prev) => ({
      ...prev,
      department: deptName,
      members: [],
    }));
    setMemberSearch("");
    setMemberSearchApplied("");
  }

  async function deleteCategory(c: Category) {
    const nextCats = categories.filter((x) => x.id !== c.id);
    const nextTmpls = templates.filter((t) => t.category !== c.name);
    await saveCategories(nextCats);
    await saveTemplates(nextTmpls);
    if (activeCategory === c.name) {
      setActiveCategory(nextCats[0]?.name || "");
    }
    toast({ title: "Category deleted", variant: "success" });
  }

  async function saveCategory() {
    if (!catForm.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    if (!catForm.department) {
      toast({
        title: "Department required — category must route to a department",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    // Keep only members that still belong to the routed department
    const deptKey = catForm.department.trim().toLowerCase();
    const validIds = new Set(
      allUsers
        .filter((u) => (u.department || "").trim().toLowerCase() === deptKey)
        .map((u) => u._id)
    );
    const members = [...new Set(catForm.members.filter((id) => validIds.has(id)))];
    let next: Category[];
    if (editingCat) {
      const oldName = editingCat.name;
      const newName = catForm.name.trim();
      next = categories.map((c) =>
        c.id === editingCat.id
          ? {
              ...c,
              name: newName,
              description: catForm.description,
              department: catForm.department,
              members,
            }
          : c
      );
      // Keep templates in sync if category renamed / department changed
      if (oldName !== newName || editingCat.department !== catForm.department) {
        const nextTmpls = templates.map((t) => {
          if (t.category !== oldName) return t;
          return {
            ...t,
            category: newName,
            defaultFields: { ...t.defaultFields, department: catForm.department },
          };
        });
        await saveTemplates(nextTmpls);
      }
      if (activeCategory === oldName) setActiveCategory(newName);
    } else {
      next = [
        ...categories,
        {
          id: `cat-${Date.now()}`,
          name: catForm.name.trim(),
          description: catForm.description,
          department: catForm.department,
          members,
        },
      ];
    }
    await saveCategories(next);
    if (!activeCategory || !editingCat) setActiveCategory(catForm.name.trim());
    setCatOpen(false);
    resetMemberPicker();
    toast({
      title: "Category saved",
      description: members.length
        ? `${members.length} handler(s) will receive ticket notifications`
        : undefined,
      variant: "success",
    });
    setSaving(false);
  }

  function openNewTemplate() {
    if (!activeCategory) {
      toast({ title: "Create a category first", variant: "destructive" });
      return;
    }
    setEditingTmpl(null);
    setTmplForm({
      name: "",
      description: "",
      needApproval: false,
      approvalLabel: "",
      approver: "",
      requestType: "Request",
      urgency: "Normal",
      department: departmentForCategory(activeCategory),
      subject: "",
      body: "",
      project: "",
    });
    setTmplOpen(true);
  }

  function openEditTemplate(t: Template) {
    setEditingTmpl(t);
    const label =
      (t.approvalLabel as DeptRoleLabel | undefined) ||
      (t.defaultFields?.approvalLabel as DeptRoleLabel | undefined) ||
      "";
    setTmplForm({
      name: t.name,
      description: t.description || "",
      needApproval: !!t.needApproval,
      approvalLabel: label || "",
      approver: t.approver || (t.defaultFields?.approver as string) || "",
      requestType: t.defaultFields.requestType || "Request",
      urgency: t.defaultFields.urgency || "Normal",
      department: t.defaultFields.department || departmentForCategory(t.category),
      subject: t.defaultFields.subject || "",
      body: t.defaultFields.description || "",
      project: t.defaultFields.project || "",
    });
    setTmplOpen(true);
  }

  async function saveTemplate() {
    if (!tmplForm.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    if (tmplForm.needApproval) {
      if (!tmplForm.approvalLabel) {
        toast({
          title: "Approval label required",
          description: "Checklist Director, Manager, atau Supervisor",
          variant: "destructive",
        });
        return;
      }
      if (!tmplForm.approver) {
        toast({
          title: "Approver required",
          description: "Pilih orang di label yang di-checklist",
          variant: "destructive",
        });
        return;
      }
    }
    setSaving(true);
    const routedDepartment = departmentForCategory(activeCategory);
    const payload: Template = {
      id: editingTmpl?.id || `tmpl-${Date.now()}`,
      name: tmplForm.name.trim(),
      category: activeCategory,
      description: tmplForm.description,
      needApproval: tmplForm.needApproval,
      approvalLabel: tmplForm.needApproval ? (tmplForm.approvalLabel as DeptRoleLabel) : undefined,
      approver: tmplForm.needApproval ? tmplForm.approver : undefined,
      defaultFields: {
        requestType: tmplForm.requestType,
        urgency: tmplForm.urgency,
        department: routedDepartment,
        subject: tmplForm.subject,
        description: tmplForm.body,
        project: tmplForm.project,
        ...(tmplForm.needApproval && tmplForm.approver
          ? {
              approver: tmplForm.approver,
              approvalLabel: tmplForm.approvalLabel,
            }
          : {}),
      },
    };
    let next: Template[];
    if (editingTmpl) {
      next = templates.map((t) => (t.id === editingTmpl.id ? payload : t));
    } else {
      next = [...templates, payload];
    }
    await saveTemplates(next);
    setTmplOpen(false);
    toast({ title: "Template saved", variant: "success" });
    setSaving(false);
  }

  async function deleteTemplate(id: string) {
    await saveTemplates(templates.filter((t) => t.id !== id));
    toast({ title: "Deleted", variant: "success" });
  }

  const categoryTemplates = templates.filter((t) => t.category === activeCategory);
  const activeCat = categories.find((c) => c.name === activeCategory);

  if (loading) {
    return (
      <div className="flex justify-center h-64 items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ticket Template</h1>
          <p className="text-muted-foreground">
            Help requesters create tickets from prepared templates
          </p>
        </div>
        <Button type="button" onClick={openNewCategory}>
          <Plus className="h-4 w-4 mr-2" /> New Category
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-muted-foreground gap-2">
            <FileStack className="h-10 w-10 opacity-30" />
            <p>
              {departments.length === 0
                ? "Create a Department first (Users Management → Manage Department)."
                : "No categories yet. Create a category first."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 p-2">
              {categories.map((c) => {
                const selected = activeCategory === c.name;
                return (
                  <div
                    key={c.id}
                    className={
                      selected
                        ? "flex items-center gap-0.5 rounded-lg bg-blue-600 text-white shadow-sm"
                        : "flex items-center gap-0.5 rounded-lg hover:bg-accent"
                    }
                  >
                    <button
                      type="button"
                      title={`${c.name} → ${c.department}`}
                      onClick={() => setActiveCategory(c.name)}
                      className={
                        selected
                          ? "min-w-0 flex-1 text-left rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-150 cursor-pointer text-white"
                          : "min-w-0 flex-1 text-left rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 cursor-pointer text-slate-700 dark:text-slate-200"
                      }
                    >
                      <span className="block truncate">{c.name}</span>
                      <span
                        className={
                          selected
                            ? "block text-[11px] font-normal opacity-90 truncate"
                            : "block text-[11px] font-normal text-muted-foreground truncate"
                        }
                      >
                        → {c.department}
                        {(c.members?.length || 0) > 0
                          ? ` · ${c.members!.length} handler${c.members!.length === 1 ? "" : "s"}`
                          : ""}
                      </span>
                    </button>
                    <div
                      className={
                        selected
                          ? "shrink-0 pr-1 [&_button]:text-white [&_button]:hover:bg-blue-500 [&_button]:hover:text-white"
                          : "shrink-0 pr-1"
                      }
                      onClick={(e) => e.stopPropagation()}
                    >
                      <RowSettingsMenu
                        objectName={c.name}
                        onEdit={() => {
                          setActiveCategory(c.name);
                          openEditCategory(c);
                        }}
                        onDelete={() => deleteCategory(c)}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold tracking-tight">{activeCategory}</h2>
                  {activeCat && (
                    <RowSettingsMenu
                      objectName={activeCat.name}
                      onEdit={() => openEditCategory(activeCat)}
                      onDelete={() => deleteCategory(activeCat)}
                    />
                  )}
                </div>
                <h3 className="text-sm font-medium text-muted-foreground mt-0.5">
                  Templates
                  {activeCat && (activeCat.members?.length || 0) > 0
                    ? ` · ${activeCat.members!.length} handler(s)`
                    : ""}
                </h3>
              </div>
              <Button size="sm" onClick={openNewTemplate}>
                <Plus className="h-4 w-4 mr-1" /> New Request Template
              </Button>
            </div>

            <div className="space-y-3">
              {categoryTemplates.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground text-sm">
                    No templates in this category
                  </CardContent>
                </Card>
              ) : (
                categoryTemplates.map((t) => (
                  <Card key={t.id}>
                    <CardContent className="p-4 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{t.name}</p>
                          {t.needApproval && (
                            <Badge variant="outline">
                              Approval
                              {t.approvalLabel || t.defaultFields?.approvalLabel
                                ? `: ${t.approvalLabel || t.defaultFields?.approvalLabel}`
                                : ""}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t.description || t.defaultFields.subject || "—"}
                        </p>
                      </div>
                      <RowSettingsMenu
                        objectName={t.name}
                        onEdit={() => openEditTemplate(t)}
                        onDelete={() => deleteTemplate(t.id)}
                      />
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* New / Edit Category — linked to Department + handlers */}
      <Dialog
        open={catOpen}
        onOpenChange={(o) => {
          setCatOpen(o);
          if (!o) resetMemberPicker();
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCat ? "Edit" : "New"} Category</DialogTitle>
            <DialogDescription>
              Route ke Department, lalu pilih orang yang bisa mengerjakan &amp; menerima notifikasi
              ticket category ini.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={catForm.name}
                onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Route to Department *</Label>
              {departments.length === 0 ? (
                <div className="space-y-2">
                  <Input
                    value={catForm.department}
                    onChange={(e) => onCategoryDepartmentChange(e.target.value)}
                    placeholder="e.g. IT"
                  />
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Belum ada data di Manage Department. Isi nama department manual, atau tambah dulu di{" "}
                    <strong>Users Management → Manage Department</strong> lalu refresh.
                  </p>
                </div>
              ) : (
                <Select
                  value={catForm.department || undefined}
                  onValueChange={onCategoryDepartmentChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id || d.name} value={d.name}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={catForm.description}
                onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                rows={2}
              />
            </div>

            {/* Handlers only from Route department */}
            <div className="rounded-lg border p-3 space-y-3 bg-muted/15">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Label className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Handlers &amp; notifications
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Hanya orang dari department{" "}
                    <span className="font-medium text-foreground">
                      {catForm.department || "—"}
                    </span>
                    . Merekalah yang menerima notifikasi ticket category ini (+ Approver jika ada).
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {catForm.members.length} selected
                </Badge>
              </div>

              {!catForm.department ? (
                <p className="text-sm text-muted-foreground p-2">
                  Pilih Route to Department dulu untuk melihat user.
                </p>
              ) : (
                <>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-8"
                        placeholder="Search name or email..."
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            setMemberSearchApplied(memberSearch);
                          }
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setMemberSearchApplied(memberSearch)}
                    >
                      <Search className="h-4 w-4 mr-1" />
                      Search
                    </Button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {filteredDeptUsers.length} of {deptUsers.length} in {catForm.department}
                    </span>
                    {deptUsers.length > 0 && (
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => {
                          const ids = filteredDeptUsers.map((u) => u._id);
                          const allSelected =
                            ids.length > 0 && ids.every((id) => catForm.members.includes(id));
                          selectAllMembers(ids, !allSelected);
                        }}
                      >
                        {filteredDeptUsers.length > 0 &&
                        filteredDeptUsers.every((u) => catForm.members.includes(u._id))
                          ? "Unselect shown"
                          : "Select shown"}
                      </button>
                    )}
                  </div>

                  <div className="max-h-[280px] overflow-y-auto space-y-1 rounded-md border bg-background p-1.5">
                    {deptUsers.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-3 text-center">
                        Tidak ada user di department {catForm.department}. Pastikan field Department
                        user sudah diisi.
                      </p>
                    ) : filteredDeptUsers.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-3 text-center">
                        No users match &quot;{memberSearchApplied}&quot;.
                      </p>
                    ) : (
                      filteredDeptUsers.map((u) => (
                        <label
                          key={u._id}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer hover:bg-accent/40",
                            catForm.members.includes(u._id) && "bg-primary/5"
                          )}
                        >
                          <Checkbox
                            checked={catForm.members.includes(u._id)}
                            onCheckedChange={() => toggleMember(u._id)}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{u.displayName}</p>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCatOpen(false);
                resetMemberPicker();
              }}
            >
              Cancel
            </Button>
            <Button onClick={saveCategory} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Template form */}
      <Dialog open={tmplOpen} onOpenChange={setTmplOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTmpl ? "Edit" : "New"} Request Template</DialogTitle>
            <DialogDescription>
              Same structure as Request Creation Form + Need Approval?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Template Name *</Label>
                <Input
                  value={tmplForm.name}
                  onChange={(e) => setTmplForm({ ...tmplForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input value={activeCategory} disabled className="bg-muted" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={tmplForm.description}
                onChange={(e) => setTmplForm({ ...tmplForm, description: e.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Req Type</Label>
                <Select
                  value={tmplForm.requestType}
                  onValueChange={(v) => setTmplForm({ ...tmplForm, requestType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Incident">Incident</SelectItem>
                    <SelectItem value="Request">Request</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Urgency</Label>
                <Select
                  value={tmplForm.urgency}
                  onValueChange={(v) => setTmplForm({ ...tmplForm, urgency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Very Low", "Low", "Normal", "High", "Very High"].map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Department (dari Category)</Label>
                <Input value={tmplForm.department} disabled className="bg-muted" />
                <p className="text-[11px] text-muted-foreground">
                  Auto from category → department
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Subject (default)</Label>
              <Input
                value={tmplForm.subject}
                onChange={(e) => setTmplForm({ ...tmplForm, subject: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (default, rich text)</Label>
              <RichTextEditor
                value={tmplForm.body}
                onChange={(html) => setTmplForm({ ...tmplForm, body: html })}
                minHeight="120px"
              />
            </div>
            <div className="space-y-2">
              <Label>Project</Label>
              <Input
                value={tmplForm.project}
                onChange={(e) => setTmplForm({ ...tmplForm, project: e.target.value })}
              />
            </div>

            <div className="rounded-lg border p-4 space-y-3 bg-muted/15">
              <div>
                <Label>Approval (SuperAdmin only)</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Checklist satu label hierarchy. Dropdown orang diisi dari Manage Department
                  (Director / Manager / Supervisor).
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                {DEPT_ROLE_LABELS.map((lab) => (
                  <label key={lab} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={tmplForm.needApproval && tmplForm.approvalLabel === lab}
                      onCheckedChange={(v) => {
                        if (v) {
                          setTmplForm({
                            ...tmplForm,
                            needApproval: true,
                            approvalLabel: lab,
                            approver: "",
                          });
                        } else if (tmplForm.approvalLabel === lab) {
                          setTmplForm({
                            ...tmplForm,
                            needApproval: false,
                            approvalLabel: "",
                            approver: "",
                          });
                        }
                      }}
                    />
                    {lab}
                  </label>
                ))}
              </div>
              {tmplForm.needApproval && tmplForm.approvalLabel && (
                <div className="space-y-2">
                  <Label>Approver ({tmplForm.approvalLabel}) *</Label>
                  <Select
                    value={tmplForm.approver || "none"}
                    onValueChange={(v) =>
                      setTmplForm({ ...tmplForm, approver: v === "none" ? "" : v })
                    }
                    disabled={!tmplForm.department || loadingApprovers}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          !tmplForm.department
                            ? "Department belum terisi"
                            : loadingApprovers
                              ? "Loading..."
                              : `Pilih ${tmplForm.approvalLabel}`
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {approverOptions.map((a) => (
                        <SelectItem key={a._id} value={a._id}>
                          {a.displayName}
                          {a.email ? ` (${a.email})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!loadingApprovers &&
                    tmplForm.department &&
                    approverOptions.length === 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Belum ada orang di label {tmplForm.approvalLabel} untuk department{" "}
                        {tmplForm.department}. Assign dulu di Manage Department.
                      </p>
                    )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTmplOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveTemplate} disabled={saving}>
              {saving ? "Saving..." : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
