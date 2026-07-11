"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RichTextEditor, RichTextContent } from "@/components/ui/rich-text-editor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/providers/auth-provider";
import { formatDateTime, getInitials } from "@/lib/utils";
import { StatusBadge, PriorityBadge } from "@/components/ui/meta-badge";
import { ArrowLeft, Send, Clock, User, MessageSquare, ScrollText } from "lucide-react";
import {
  allowedNextStatuses,
  isPendingApproval,
  isTerminalStatus,
  TICKET_STATUS_NAMES,
} from "@/lib/ticket-status";
import { defaultStatusLogMessage } from "@/lib/ticket-logs";

export default function TicketDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [ticket, setTicket] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [technicians, setTechnicians] = useState<{ _id: string; displayName: string }[]>([]);
  const [updating, setUpdating] = useState(false);

  // Status change → Logs form dialog
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState("");
  const [logDraft, setLogDraft] = useState("");

  useEffect(() => {
    loadTicket();
    fetch("/api/users?userType=Technician&limit=100")
      .then((r) => r.json())
      .then((d) => setTechnicians(d.data || []));
  }, [id]);

  async function loadTicket() {
    try {
      const ticketId = Array.isArray(id) ? id[0] : id;
      if (!ticketId) {
        setTicket(null);
        setLoading(false);
        return;
      }
      const res = await fetch(`/api/tickets/${ticketId}`);
      const data = await res.json();
      if (data.success) {
        setTicket(data.data);
      } else {
        setTicket(null);
        toast({
          title: data.error || "Ticket not found",
          variant: "destructive",
        });
      }
    } catch {
      setTicket(null);
      toast({ title: "Failed to load ticket", variant: "destructive" });
    }
    setLoading(false);
  }

  async function updateTicket(updates: Record<string, unknown>) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success) {
        setTicket(data.data);
        toast({ title: "Ticket updated", variant: "success" });
        return true;
      }
      toast({ title: data.error || "Update failed", variant: "destructive" });
      return false;
    } catch {
      toast({ title: "Error updating ticket", variant: "destructive" });
      return false;
    } finally {
      setUpdating(false);
    }
  }

  async function addComment() {
    if (!comment || comment === "<p></p>" || !comment.replace(/<[^>]+>/g, "").trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tickets/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: comment, isPrivate }),
      });
      const data = await res.json();
      if (data.success) {
        setComment("");
        loadTicket();
        toast({ title: "Comment added", variant: "success" });
      }
    } catch {}
    setSubmitting(false);
  }

  function openStatusLogForm(nextStatus: string) {
    if (!ticket || nextStatus === String(ticket.status)) return;
    const creator =
      (ticket.requester as Record<string, unknown> | undefined)?.displayName as string ||
      (ticket.requesterName as string) ||
      "Requester";
    const actorName = user?.displayName || "Technician";
    setPendingStatus(nextStatus);
    setLogDraft(
      defaultStatusLogMessage({
        status: nextStatus,
        creatorName: creator,
        actorName,
        ticketNumber: ticket.ticketNumber as string,
      })
    );
    setStatusDialogOpen(true);
  }

  async function confirmStatusChange() {
    if (!pendingStatus) return;
    if (!logDraft.trim()) {
      toast({ title: "Log message required", variant: "destructive" });
      return;
    }
    const ok = await updateTicket({
      status: pendingStatus,
      logMessage: logDraft.trim(),
    });
    if (ok) {
      setStatusDialogOpen(false);
      setPendingStatus("");
      setLogDraft("");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!ticket) {
    return <div className="text-center py-16 text-muted-foreground">Ticket not found</div>;
  }

  const isSuperAdmin = user?.role === "SuperAdmin";
  const isTechOrAdmin = isSuperAdmin || !!user?.userTypes.includes("Technician");
  const approverRef = ticket.approver as Record<string, unknown> | string | undefined;
  const approverId =
    typeof approverRef === "string"
      ? approverRef
      : approverRef
        ? String(approverRef._id || "")
        : "";
  const isApprover =
    !!user?.userTypes.includes("Approver") && !!user?._id && approverId === user._id;
  const currentStatus = String(ticket.status || "Open");
  const pendingLocked = isPendingApproval(currentStatus) && ticket.approvalStatus === "Pending";
  const terminal = isTerminalStatus(currentStatus);
  const statusOptions =
    pendingLocked || terminal ? [currentStatus] : allowedNextStatuses(currentStatus);
  const requester = ticket.requester as Record<string, unknown> | undefined;
  const tech = ticket.technician as Record<string, unknown> | undefined;
  const comments = (ticket.comments as Record<string, unknown>[]) || [];
  const logs = ([...((ticket.logs as Record<string, unknown>[]) || [])] as Record<
    string,
    unknown
  >[]).sort((a, b) => {
    const ta = new Date(String(a.createdAt || 0)).getTime();
    const tb = new Date(String(b.createdAt || 0)).getTime();
    return tb - ta;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/tickets">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-muted-foreground">
              {ticket.ticketNumber as string}
            </span>
            <StatusBadge status={ticket.status as string} size="md" />
            <PriorityBadge priority={ticket.priority as string} size="md" />
          </div>
          <h1 className="text-xl font-bold mt-1">{ticket.subject as string}</h1>
        </div>
      </div>

      {isApprover && ticket.approvalStatus === "Pending" && (
        <Card className="border-purple-500 bg-purple-50 dark:bg-purple-950/30">
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-medium">This ticket requires your approval</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={updating}
                onClick={() => {
                  const creator =
                    (requester?.displayName as string) ||
                    (ticket.requesterName as string) ||
                    "Requester";
                  const msg = defaultStatusLogMessage({
                    status: "Reject",
                    creatorName: creator,
                    actorName: user?.displayName || "Approver",
                  });
                  setPendingStatus("Reject");
                  setLogDraft(msg);
                  // Approval reject uses approvalAction + log
                  setStatusDialogOpen(true);
                }}
              >
                Reject
              </Button>
              <Button
                size="sm"
                disabled={updating}
                onClick={async () => {
                  await updateTicket({
                    approvalAction: "approve",
                    logMessage: `Ticket ${ticket.ticketNumber} was Approved by ${user?.displayName || "Approver"}. Status set to Open.`,
                  });
                }}
              >
                Approve
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <RichTextContent
                html={ticket.description as string}
                emptyText="No description provided."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Comments ({comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {comments.map((c, i) => {
                const author = c.author as Record<string, unknown> | undefined;
                return (
                  <div
                    key={i}
                    className={`p-4 rounded-lg ${
                      c.isPrivate
                        ? "bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800"
                        : "bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs">
                          {author
                            ? getInitials(author?.displayName as string | undefined)
                            : "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">
                        {(author?.displayName as string) || "Unknown"}
                      </span>
                      {Boolean(c.isPrivate) && (
                        <Badge variant="outline" className="text-xs">
                          Private
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatDateTime(c.createdAt as string)}
                      </span>
                    </div>
                    <RichTextContent html={c.content as string} className="text-sm" />
                  </div>
                );
              })}

              <Separator />
              <div className="space-y-3">
                <RichTextEditor
                  value={comment}
                  onChange={setComment}
                  placeholder="Add a comment..."
                  minHeight="100px"
                />
                <div className="flex items-center justify-between">
                  {isTechOrAdmin && (
                    <div className="flex items-center gap-2">
                      <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
                      <Label className="text-sm">Private note</Label>
                    </div>
                  )}
                  <Button
                    onClick={addComment}
                    disabled={
                      submitting ||
                      !comment ||
                      comment === "<p></p>" ||
                      !comment.replace(/<[^>]+>/g, "").trim()
                    }
                    size="sm"
                  >
                    <Send className="h-4 w-4 mr-2" /> {submitting ? "Sending..." : "Send"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activity Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ScrollText className="h-4 w-4" /> Logs ({logs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No logs yet.</p>
              ) : (
                logs.map((log, i) => {
                  const actorPop = log.actor as Record<string, unknown> | undefined;
                  const name =
                    (actorPop?.displayName as string) ||
                    (log.actorName as string) ||
                    "System";
                  const email =
                    (actorPop?.email as string) || (log.actorEmail as string) || "";
                  return (
                    <div
                      key={(log._id as string) || i}
                      className="flex gap-3 rounded-lg border bg-muted/20 p-3"
                    >
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback className="text-sm">
                          {getInitials(name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{name}</p>
                            {email ? (
                              <p className="text-[11px] text-muted-foreground truncate">
                                {email}
                              </p>
                            ) : null}
                          </div>
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                            {formatDateTime(log.createdAt as string)}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-muted-foreground mt-1.5 uppercase tracking-wide">
                          {(log.action as string)?.replace(/_/g, " ") || "Log"}
                          {log.fromStatus && log.toStatus
                            ? ` · ${log.fromStatus} → ${log.toStatus}`
                            : log.toStatus
                              ? ` · ${log.toStatus}`
                              : ""}
                        </p>
                        <pre className="mt-2 whitespace-pre-wrap break-words text-sm font-sans text-foreground/90 leading-relaxed">
                          {log.message as string}
                        </pre>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Requester</p>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {(requester?.displayName as string) || (ticket.requesterName as string)}
                  </span>
                </div>
              </div>

              {isTechOrAdmin && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Select
                    value={currentStatus}
                    onValueChange={(v) => openStatusLogForm(v)}
                    disabled={pendingLocked || terminal || updating}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                      {!statusOptions.includes(currentStatus) &&
                        !TICKET_STATUS_NAMES.includes(
                          currentStatus as (typeof TICKET_STATUS_NAMES)[number]
                        ) && (
                          <SelectItem value={currentStatus}>{currentStatus}</SelectItem>
                        )}
                    </SelectContent>
                  </Select>
                  {pendingLocked && (
                    <p className="text-[11px] text-muted-foreground">
                      Pending Approval — status locked until Approve → Open or Reject.
                    </p>
                  )}
                  {terminal && !pendingLocked && (
                    <p className="text-[11px] text-muted-foreground">
                      {currentStatus} is final — cannot change status.
                    </p>
                  )}
                  {!pendingLocked && !terminal && (
                    <p className="text-[11px] text-muted-foreground">
                      Changing status opens a Logs form (required).
                    </p>
                  )}
                </div>
              )}

              {/* Priority: read-only for Technician; SuperAdmin can edit */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Priority</p>
                {isSuperAdmin ? (
                  <Select
                    value={ticket.priority as string}
                    onValueChange={(v) => updateTicket({ priority: v })}
                    disabled={updating}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Very Low", "Low", "Normal", "High", "Very High"].map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                    <PriorityBadge priority={ticket.priority as string} size="sm" />
                    <span className="text-[11px] text-muted-foreground">
                      {isTechOrAdmin ? "Technicians cannot change priority" : ""}
                    </span>
                  </div>
                )}
              </div>

              {isTechOrAdmin && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Technician</p>
                  <Select
                    value={(tech?._id as string) || "none"}
                    onValueChange={(v) =>
                      updateTicket({ technician: v === "none" ? null : v })
                    }
                    disabled={updating}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Unassigned" />
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
              )}

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span>{ticket.requestType as string}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Impact</span>
                  <span>{ticket.impact as string}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Urgency</span>
                  <span>{ticket.urgency as string}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Department</span>
                  <span>
                    {(ticket.department as string) || (ticket.group as string)}
                  </span>
                </div>
                {Boolean(ticket.category) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category</span>
                    <span>{ticket.category as string}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3 w-3" /> Created{" "}
                  {formatDateTime(ticket.createdAt as string)}
                </div>
                {Boolean(ticket.closedAt) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-3 w-3" /> Closed{" "}
                    {formatDateTime(ticket.closedAt as string)}
                  </div>
                )}
              </div>

              {isTechOrAdmin &&
                (ticket.status === "Closed" || ticket.status === "Reject") &&
                isSuperAdmin && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Closure Code</p>
                      <Select
                        value={(ticket.closureCode as string) || ""}
                        onValueChange={(v) => updateTicket({ closureCode: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Success">Success</SelectItem>
                          <SelectItem value="Rejected">Rejected</SelectItem>
                          <SelectItem value="Unable to Reproduce">
                            Unable to Reproduce
                          </SelectItem>
                          <SelectItem value="Duplicate">Duplicate</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Status change Logs form */}
      <Dialog
        open={statusDialogOpen}
        onOpenChange={(o) => {
          if (!o) {
            setStatusDialogOpen(false);
            setPendingStatus("");
            setLogDraft("");
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Logs Info — {pendingStatus}</DialogTitle>
            <DialogDescription>
              Pesan ini tersimpan di Logs ticket dan dikirim ke requester. Edit alasan di bawah
              &quot;With reasons:&quot; bila perlu.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Status change: </span>
              <span className="font-medium">{currentStatus}</span>
              <span className="text-muted-foreground"> → </span>
              <span className="font-medium">{pendingStatus}</span>
            </div>
            <div className="space-y-2">
              <Label>Log message *</Label>
              <Textarea
                value={logDraft}
                onChange={(e) => setLogDraft(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setStatusDialogOpen(false);
                setPendingStatus("");
                setLogDraft("");
              }}
              disabled={updating}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                // Approver reject from banner uses pendingStatus Reject + approvalAction
                if (
                  isApprover &&
                  pendingStatus === "Reject" &&
                  ticket.approvalStatus === "Pending"
                ) {
                  const ok = await updateTicket({
                    approvalAction: "reject",
                    logMessage: logDraft.trim(),
                  });
                  if (ok) {
                    setStatusDialogOpen(false);
                    setPendingStatus("");
                    setLogDraft("");
                  }
                  return;
                }
                await confirmStatusChange();
              }}
              disabled={updating || !logDraft.trim()}
            >
              {updating ? "Saving..." : "Confirm & Save Log"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
