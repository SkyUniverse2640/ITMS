"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { AnimatedList } from "@/components/ui/animated-list";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime } from "@/lib/utils";
import { ArrowLeft, Bell, Check, CheckCheck, Trash2 } from "lucide-react";

interface Notif {
  _id: string;
  title: string;
  message: string;
  type: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/notifications?limit=100");
        const data = await res.json();
        if (data.success) setNotifications(data.data || []);
      } catch {
        /* ignore */
      }
      setLoading(false);
    }

    load();
  }, []);

  async function markRead(ids: string[]) {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n._id) ? { ...n, read: true } : n))
    );
  }

  async function markAll() {
    setBusy(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      const data = await res.json();
      if (data.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        toast({ title: "All marked as read", variant: "success" });
      } else {
        toast({ title: data.error || "Failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to mark all as read", variant: "destructive" });
    }
    setBusy(false);
  }

  async function deleteAll() {
    setBusy(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteAll: true }),
      });
      const data = await res.json();
      if (data.success) {
        setNotifications([]);
        setDeleteAllOpen(false);
        toast({
          title: "All messages deleted",
          description: data.data?.deleted
            ? `${data.data.deleted} notification(s) removed`
            : undefined,
          variant: "success",
        });
      } else {
        toast({ title: data.error || "Failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to delete all", variant: "destructive" });
    }
    setBusy(false);
  }

  async function deleteOne(id: string) {
    try {
      const res = await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      const data = await res.json();
      if (data.success) {
        setNotifications((prev) => prev.filter((n) => n._id !== id));
      }
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const showBulk = notifications.length > 1;
  const notificationItems = notifications.map((n) => {
    const details = (
      <>
        <div
          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
            !n.read ? "bg-primary" : "bg-transparent"
          }`}
        />
        <div className="min-w-0">
          <p className="text-sm font-medium">{n.title}</p>
          <p className="text-sm text-muted-foreground">{n.message}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDateTime(n.createdAt)}
          </p>
        </div>
      </>
    );
    const content = (
      <div
        className={`flex items-start gap-3 p-4 transition-colors hover:bg-muted/50 ${
          !n.read ? "bg-primary/5" : ""
        }`}
      >
        {n.link ? (
          <Link
            href={n.link}
            className="flex min-w-0 flex-1 items-start gap-3"
            onClick={() => markRead([n._id])}
          >
            {details}
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-start gap-3">{details}</div>
        )}
        <div className="flex shrink-0 items-center gap-0.5">
          {!n.read && (
            <Button
              variant="ghost"
              size="icon"
              title="Mark as read"
              aria-label={`Mark ${n.title} as read`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                markRead([n._id]);
              }}
            >
              <Check className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            title="Delete"
            aria-label={`Delete ${n.title}`}
            className="text-muted-foreground hover:text-red-600"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              deleteOne(n._id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );

    return { key: n._id, content };
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Notifications"
        description={
          <>
            {notifications.length} total
            {unreadCount > 0 ? ` · ${unreadCount} unread` : ""}
          </>
        }
        backAction={
          <Link href="/">
            <Button variant="ghost" size="icon" title="Back" aria-label="Back to dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        }
        actions={
          showBulk ? (
            <>
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={markAll} disabled={busy}>
                  <CheckCheck className="h-4 w-4 mr-2" /> Mark all as read
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/40 dark:border-red-900"
                onClick={() => setDeleteAllOpen(true)}
                disabled={busy}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete all messages
              </Button>
            </>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <LoadingState label="Loading notifications" className="h-48" />
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground gap-2">
              <Bell className="h-10 w-10 opacity-30" />
              <p>No notifications</p>
            </div>
          ) : (
            <AnimatedList items={notificationItems} />
          )}
        </CardContent>
      </Card>

      {/* Confirm delete all */}
      <Dialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete all messages?</DialogTitle>
            <DialogDescription>
              This will permanently remove all {notifications.length} notification
              {notifications.length === 1 ? "" : "s"} from your inbox. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteAllOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteAll}
              disabled={busy}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {busy ? "Deleting..." : "Delete all"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
