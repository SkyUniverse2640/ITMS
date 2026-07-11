"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toast";
import { Save, Mail } from "lucide-react";

interface NotifEvent {
  enabled: boolean;
  template: string;
}

interface SmtpConfig {
  host: string;
  port: string;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

const EVENT_LABELS: Record<string, { label: string; desc: string }> = {
  ticketCreated: { label: "Ticket Created", desc: "When a new ticket is created" },
  ticketAssigned: { label: "Ticket Assigned", desc: "When a technician is assigned" },
  statusChanged: { label: "Status Changed", desc: "When ticket status changes" },
  commentAdded: { label: "Comment Added (Public)", desc: "When a public reply is added" },
  slaWarning: { label: "SLA Warning", desc: "When approaching SLA breach (75%)" },
  slaBreach: { label: "SLA Breach", desc: "When SLA is breached (100%)" },
  approvalRequested: { label: "Approval Requested", desc: "When approval is needed" },
  approvalDecision: { label: "Approval Decision", desc: "When approved/rejected" },
  assetAssigned: { label: "Asset Assigned", desc: "When asset is assigned to a user" },
  purchaseUpdate: { label: "Purchase Status Update", desc: "When purchase request changes" },
};

const DEFAULT_SMTP: SmtpConfig = {
  host: "",
  port: "587",
  secure: false,
  username: "",
  password: "",
  fromEmail: "",
  fromName: "NexusDesk",
};

export default function NotificationSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, NotifEvent>>({});
  const [smtp, setSmtp] = useState<SmtpConfig>(DEFAULT_SMTP);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [notifRes, smtpRes] = await Promise.all([
        fetch("/api/settings?key=notificationSettings").then((r) => r.json()),
        fetch("/api/settings?key=smtp").then((r) => r.json()),
      ]);
      setSettings(notifRes.data || {});
      if (smtpRes.data) setSmtp({ ...DEFAULT_SMTP, ...smtpRes.data });
    } catch {
      /* ignore */
    }
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    try {
      await Promise.all([
        fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "notificationSettings", value: settings }),
        }),
        fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "smtp", value: smtp }),
        }),
      ]);
      toast({ title: "Notification settings saved", variant: "success" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
    setSaving(false);
  }

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
          <h1 className="text-2xl font-bold tracking-tight">Notification Settings</h1>
          <p className="text-muted-foreground">
            SMTP configuration and event notification templates
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save All"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" /> SMTP Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>SMTP Host</Label>
              <Input
                value={smtp.host}
                onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                placeholder="smtp.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Port</Label>
              <Input
                value={smtp.port}
                onChange={(e) => setSmtp({ ...smtp, port: e.target.value })}
                placeholder="587"
              />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={smtp.username}
                onChange={(e) => setSmtp({ ...smtp, username: e.target.value })}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={smtp.password}
                onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label>From Email</Label>
              <Input
                value={smtp.fromEmail}
                onChange={(e) => setSmtp({ ...smtp, fromEmail: e.target.value })}
                placeholder="noreply@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label>From Name</Label>
              <Input
                value={smtp.fromName}
                onChange={(e) => setSmtp({ ...smtp, fromName: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={smtp.secure}
              onCheckedChange={(v) => setSmtp({ ...smtp, secure: v })}
            />
            <Label>Use TLS/SSL (secure)</Label>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div>
        <h2 className="text-lg font-semibold mb-1">Notification Events</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Toggle events and edit email/in-app templates. Use {"{{variables}}"} for dynamic values.
        </p>
      </div>

      <div className="space-y-4">
        {Object.keys(EVENT_LABELS).map((key) => {
          const event = settings[key] || { enabled: true, template: "" };
          const meta = EVENT_LABELS[key];
          return (
            <Card key={key}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">{meta.label}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{meta.desc}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Label className="text-sm">{event.enabled ? "On" : "Off"}</Label>
                    <Switch
                      checked={event.enabled}
                      onCheckedChange={(v) =>
                        setSettings({ ...settings, [key]: { ...event, enabled: v } })
                      }
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={event.template}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      [key]: { ...event, template: e.target.value },
                    })
                  }
                  placeholder="Email template with {{variables}}..."
                  rows={2}
                  disabled={!event.enabled}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
