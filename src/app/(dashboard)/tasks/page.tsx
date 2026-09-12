"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Calendar, CalendarRange, Trash2, X, GripVertical } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { PriorityBadge } from "@/components/ui/meta-badge";
import { RichTextEditor, RichTextContent } from "@/components/ui/rich-text-editor";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/ui/toast";
import type { ChecklistItem } from "@/types";

interface UserOption {
  _id: string;
  displayName: string;
}

interface PopulatedRef {
  _id: string;
  displayName?: string;
  ticketNumber?: string;
  subject?: string;
}

interface TaskData {
  _id: string;
  title: string;
  description?: string;
  relatedTicket?: PopulatedRef | string;
  assignee: PopulatedRef | string;
  dateStart?: string;
  dateEnd?: string;
  dueDate?: string;
  status: "To Do" | "In Progress" | "Done";
  priority: string;
  checklist: ChecklistItem[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface TaskFormData {
  title: string;
  description: string;
  assignee: string;
  dateStart: string;
  dateEnd: string;
  priority: string;
  relatedTicket: string;
  status: "To Do" | "In Progress" | "Done";
  checklist: ChecklistItem[];
}

const COLUMNS: { key: TaskData["status"]; label: string; color: string }[] = [
  { key: "To Do", label: "To Do", color: "border-t-blue-500" },
  { key: "In Progress", label: "In Progress", color: "border-t-yellow-500" },
  { key: "Done", label: "Done", color: "border-t-green-500" },
];

const PRIORITIES = ["Very Low", "Low", "Normal", "High", "Very High"];

const EMPTY_FORM: TaskFormData = {
  title: "",
  description: "",
  assignee: "",
  dateStart: "",
  dateEnd: "",
  priority: "Normal",
  relatedTicket: "",
  status: "To Do",
  checklist: [],
};

function getAssigneeName(assignee: PopulatedRef | string): string {
  if (typeof assignee === "object" && assignee !== null) return assignee.displayName || "Unknown";
  return "Unknown";
}

function getTicketLabel(ticket: PopulatedRef | string | undefined): string | null {
  if (!ticket) return null;
  if (typeof ticket === "object" && ticket !== null) return ticket.ticketNumber || null;
  return null;
}

function getRefId(ref: PopulatedRef | string | undefined): string {
  if (!ref) return "";
  if (typeof ref === "object" && ref !== null) return ref._id;
  return ref;
}

export default function TasksPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<TaskFormData>(EMPTY_FORM);
  const [editingId, setEditingId] = useState("");
  const [newChecklistItem, setNewChecklistItem] = useState("");

  const loadTasks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (statusFilter !== "all") params.set("status", statusFilter);

    try {
      const res = await fetch(`/api/tasks?${params}`);
      const data = await res.json();
      if (data.success) {
        setTasks(data.data);
      }
    } catch {
      toast({ title: "Failed to load tasks", variant: "destructive" });
    }
    setLoading(false);
  }, [statusFilter, toast]);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users?limit=100");
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch {
      /* silently fail */
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function openCreate() {
    setForm({ ...EMPTY_FORM, assignee: user?._id || "" });
    setNewChecklistItem("");
    setCreateOpen(true);
  }

  function openEdit(task: TaskData) {
    setEditingId(task._id);
    setForm({
      title: task.title,
      description: task.description || "",
      assignee: getRefId(task.assignee),
      dateStart: task.dateStart ? task.dateStart.split("T")[0] : "",
      dateEnd: task.dateEnd ? task.dateEnd.split("T")[0] : "",
      priority: task.priority,
      relatedTicket: getRefId(task.relatedTicket),
      status: task.status,
      checklist: task.checklist.map((c) => ({ item: c.item, done: c.done })),
    });
    setNewChecklistItem("");
    setEditOpen(true);
  }

  function addChecklistItem() {
    const text = newChecklistItem.trim();
    if (!text) return;
    setForm((prev) => ({
      ...prev,
      checklist: [...prev.checklist, { item: text, done: false }],
    }));
    setNewChecklistItem("");
  }

  function removeChecklistItem(index: number) {
    setForm((prev) => ({
      ...prev,
      checklist: prev.checklist.filter((_, i) => i !== index),
    }));
  }

  function toggleChecklistItem(index: number) {
    setForm((prev) => ({
      ...prev,
      checklist: prev.checklist.map((c, i) => (i === index ? { ...c, done: !c.done } : c)),
    }));
  }

  async function handleCreate() {
    if (!form.title.trim() || !form.assignee) {
      toast({ title: "Title and assignee are required", variant: "destructive" });
      return;
    }

    if (form.dateStart && form.dateEnd && new Date(form.dateStart) >= new Date(form.dateEnd)) {
      toast({ title: "Date Start must be before Date End", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        assignee: form.assignee,
        priority: form.priority,
        status: form.status,
        checklist: form.checklist,
      };
      if (form.dateStart) body.dateStart = form.dateStart;
      if (form.dateEnd) body.dateEnd = form.dateEnd;
      if (form.relatedTicket.trim()) body.relatedTicket = form.relatedTicket.trim();

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Task created", variant: "success" });
        setCreateOpen(false);
        loadTasks();
      } else {
        toast({ title: data.error || "Failed to create task", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to create task", variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleUpdate() {
    if (!form.title.trim() || !form.assignee) {
      toast({ title: "Title and assignee are required", variant: "destructive" });
      return;
    }

    if (form.dateStart && form.dateEnd && new Date(form.dateStart) >= new Date(form.dateEnd)) {
      toast({ title: "Date Start must be before Date End", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        assignee: form.assignee,
        priority: form.priority,
        status: form.status,
        checklist: form.checklist,
      };
      if (form.dateStart) body.dateStart = form.dateStart;
      else body.dateStart = null;
      if (form.dateEnd) body.dateEnd = form.dateEnd;
      else body.dateEnd = null;
      if (form.relatedTicket.trim()) body.relatedTicket = form.relatedTicket.trim();
      else body.relatedTicket = null;

      const res = await fetch(`/api/tasks/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Task updated", variant: "success" });
        setEditOpen(false);
        loadTasks();
      } else {
        toast({ title: data.error || "Failed to update task", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to update task", variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this task?")) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${editingId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Task deleted", variant: "success" });
        setEditOpen(false);
        loadTasks();
      } else {
        toast({ title: data.error || "Failed to delete task", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to delete task", variant: "destructive" });
    }
    setSaving(false);
  }

  function getColumnTasks(status: TaskData["status"]): TaskData[] {
    return tasks.filter((t) => t.status === status);
  }

  function checklistProgress(checklist: ChecklistItem[]): { done: number; total: number; percent: number } {
    const total = checklist.length;
    if (total === 0) return { done: 0, total: 0, percent: 0 };
    const done = checklist.filter((c) => c.done).length;
    return { done, total, percent: Math.round((done / total) * 100) };
  }

  const taskFormDialog = (
    <>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="task-title">Title *</Label>
          <Input
            id="task-title"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Task title"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="task-desc">Description</Label>
          <RichTextEditor
            value={form.description}
            onChange={(html) => setForm((prev) => ({ ...prev, description: html }))}
            placeholder="Task description..."
            minHeight="120px"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Assignee *</Label>
            <Select
              value={form.assignee}
              onValueChange={(v) => setForm((prev) => ({ ...prev, assignee: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select assignee" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u._id} value={u._id}>
                    {u.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Priority</Label>
            <Select
              value={form.priority}
              onValueChange={(v) => setForm((prev) => ({ ...prev, priority: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="task-date-start">Date Start</Label>
            <Input
              id="task-date-start"
              type="date"
              value={form.dateStart}
              onChange={(e) => setForm((prev) => ({ ...prev, dateStart: e.target.value }))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="task-date-end">Date End</Label>
            <Input
              id="task-date-end"
              type="date"
              value={form.dateEnd}
              min={form.dateStart || undefined}
              onChange={(e) => setForm((prev) => ({ ...prev, dateEnd: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {editOpen && (
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, status: v as TaskData["status"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLUMNS.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="task-ticket">Related Ticket ID</Label>
          <Input
            id="task-ticket"
            value={form.relatedTicket}
            onChange={(e) => setForm((prev) => ({ ...prev, relatedTicket: e.target.value }))}
            placeholder="Optional ticket ID"
          />
        </div>

        <Separator />

        <div className="grid gap-2">
          <Label>Checklist</Label>
          <div className="flex gap-2">
            <Input
              value={newChecklistItem}
              onChange={(e) => setNewChecklistItem(e.target.value)}
              placeholder="Add checklist item..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addChecklistItem();
                }
              }}
            />
            <Button type="button" variant="secondary" size="sm" onClick={addChecklistItem}>
              Add
            </Button>
          </div>

          {form.checklist.length > 0 && (
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-2 pr-3">
                {form.checklist.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 group">
                    <Checkbox
                      checked={item.done}
                      onCheckedChange={() => toggleChecklistItem(i)}
                    />
                    <span
                      className={`flex-1 text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}
                    >
                      {item.item}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeChecklistItem(i)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">{tasks.length} tasks</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> New Task
        </Button>
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="To Do">To Do</TabsTrigger>
          <TabsTrigger value="In Progress">In Progress</TabsTrigger>
          <TabsTrigger value="Done">Done</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : statusFilter !== "all" ? (
        /* Single column view when filtering */
        <div className="grid gap-3">
          {getColumnTasks(statusFilter as TaskData["status"]).length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                No tasks with status &quot;{statusFilter}&quot;
              </CardContent>
            </Card>
          ) : (
            getColumnTasks(statusFilter as TaskData["status"]).map((task) => (
              <TaskCard key={task._id} task={task} onClick={() => openEdit(task)} checklistProgress={checklistProgress} />
            ))
          )}
        </div>
      ) : (
        /* Kanban board when showing all */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {COLUMNS.map((col) => {
            const colTasks = getColumnTasks(col.key);
            return (
              <div key={col.key} className="space-y-3">
                <div className={`flex items-center justify-between border-t-4 ${col.color} rounded-t-md pt-2`}>
                  <h2 className="font-semibold text-sm">{col.label}</h2>
                  <Badge variant="secondary" className="text-xs">
                    {colTasks.length}
                  </Badge>
                </div>
                <ScrollArea className="max-h-[calc(100vh-280px)]">
                  <div className="space-y-3 pr-2">
                    {colTasks.length === 0 ? (
                      <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
                        No tasks
                      </div>
                    ) : (
                      colTasks.map((task) => (
                        <TaskCard
                          key={task._id}
                          task={task}
                          onClick={() => openEdit(task)}
                          checklistProgress={checklistProgress}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
            <DialogDescription>Create a new task and assign it to a team member.</DialogDescription>
          </DialogHeader>
          {taskFormDialog}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>Update the task details, checklist, and status.</DialogDescription>
          </DialogHeader>
          {taskFormDialog}
          <DialogFooter className="flex !justify-between">
            <Button variant="destructive" onClick={handleDelete} disabled={saving} size="sm">
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleUpdate} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---- Task Card Component ---- */

function TaskCard({
  task,
  onClick,
  checklistProgress,
}: {
  task: TaskData;
  onClick: () => void;
  checklistProgress: (checklist: ChecklistItem[]) => { done: number; total: number; percent: number };
}) {
  const progress = checklistProgress(task.checklist);
  const isOverdue = task.dateEnd && new Date(task.dateEnd) < new Date() && task.status !== "Done";

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-sm leading-tight line-clamp-2">{task.title}</h3>
          <PriorityBadge priority={task.priority} className="shrink-0" />
        </div>

        {task.description && (
          <div className="line-clamp-2 text-xs text-muted-foreground">
            <RichTextContent html={task.description} className="text-xs [&_*]:text-xs [&_*]:m-0 [&_*]:p-0" emptyText="" />
          </div>
        )}

        {(task.dateStart || task.dateEnd) && (
          <div className={`flex items-center gap-1.5 text-xs ${isOverdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"}`}>
            <CalendarRange className="h-3.5 w-3.5 shrink-0" />
            <span>
              {task.dateStart ? formatDate(task.dateStart) : "—"}
              {" → "}
              {task.dateEnd ? formatDate(task.dateEnd) : "—"}
            </span>
            {isOverdue && " (overdue)"}
          </div>
        )}

        {progress.total > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Checklist</span>
              <span>
                {progress.done}/{progress.total}
              </span>
            </div>
            <Progress value={progress.percent} className="h-1.5" />
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground truncate max-w-[150px]">
            {getAssigneeName(task.assignee)}
          </span>
          {getTicketLabel(task.relatedTicket) && (
            <Badge variant="outline" className="text-xs">
              {getTicketLabel(task.relatedTicket)}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
