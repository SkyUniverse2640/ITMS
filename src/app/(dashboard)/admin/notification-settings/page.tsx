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
import {
  Save,
  Mail,
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldCheck,
  ShieldOff,
  Lock,
  Unlock,
} from "lucide-react";

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

  // SMTP Test state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  // PIN Protection state
  const [isProtected, setIsProtected] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [showSetPin, setShowSetPin] = useState(false);
  const [showUnlockPin, setShowUnlockPin] = useState(false);
  const [showRemovePin, setShowRemovePin] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinLoading, setPinLoading] = useState(false);

  const editable = !isProtected || unlocked;

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [notifRes, smtpRes, pinRes] = await Promise.all([
        fetch("/api/settings?key=notificationSettings").then((r) => r.json()),
        fetch("/api/settings?key=smtp").then((r) => r.json()),
        fetch("/api/settings/smtp-pin").then((r) => r.json()),
      ]);
      setSettings(notifRes.data || {});
      if (smtpRes.data) setSmtp({ ...DEFAULT_SMTP, ...smtpRes.data });
      setIsProtected(pinRes.protected || false);
      setUnlocked(!pinRes.protected);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }

  async function save() {
    if (!editable) return;
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

  async function testSmtp() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/smtp-test", { method: "POST" });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, error: "Request failed" });
    }
    setTesting(false);
  }

  async function handleSetPin() {
    if (!pinInput || pinInput.length < 4 || pinInput.length > 8) {
      toast({ title: "PIN must be 4-8 digits", variant: "destructive" });
      return;
    }
    if (pinInput !== pinConfirm) {
      toast({ title: "PIN confirmation does not match", variant: "destructive" });
      return;
    }
    setPinLoading(true);
    try {
      const res = await fetch("/api/settings/smtp-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set", pin: pinInput }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Settings protected with PIN", variant: "success" });
        setIsProtected(true);
        setUnlocked(true);
        setShowSetPin(false);
        setPinInput("");
        setPinConfirm("");
      } else {
        toast({ title: data.error || "Failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to set PIN", variant: "destructive" });
    }
    setPinLoading(false);
  }

  async function handleVerifyPin() {
    if (!pinInput) return;
    setPinLoading(true);
    try {
      const res = await fetch("/api/settings/smtp-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", pin: pinInput }),
      });
      const data = await res.json();
      if (data.verified) {
        setUnlocked(true);
        setShowUnlockPin(false);
        setPinInput("");
        toast({ title: "Settings unlocked", variant: "success" });
      } else {
        toast({ title: "Incorrect PIN", variant: "destructive" });
      }
    } catch {
      toast({ title: "Verification failed", variant: "destructive" });
    }
    setPinLoading(false);
  }

  async function handleRemovePin() {
    if (!pinInput) return;
    setPinLoading(true);
    try {
      const res = await fetch("/api/settings/smtp-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", currentPin: pinInput }),
      });
      const data = await res.json();
      if (data.success) {
        setIsProtected(false);
        setUnlocked(true);
        setShowRemovePin(false);
        setPinInput("");
        toast({ title: "Protection removed", variant: "success" });
      } else {
        toast({ title: data.error || "Failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to remove protection", variant: "destructive" });
    }
    setPinLoading(false);
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
        <div className="flex items-center gap-2">
          {isProtected && !unlocked && (
            <Button variant="outline" onClick={() => { setShowUnlockPin(true); setPinInput(""); }}>
              <Unlock className="h-4 w-4 mr-2" /> Unlock Settings
            </Button>
          )}
          <Button onClick={save} disabled={saving || !editable}>
            <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save All"}
          </Button>
        </div>
      </div>

      {/* PIN Protection Banner */}
      {isProtected && !unlocked && (
        <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex items-center gap-3 py-4">
            <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-300">Settings Protected</p>
              <p className="text-sm text-amber-700 dark:text-amber-400">Enter your PIN to unlock and edit SMTP settings.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unlock PIN Card */}
      {showUnlockPin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Unlock className="h-4 w-4" /> Enter PIN to Unlock
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 max-w-xs">
              <Label>PIN</Label>
              <Input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="Enter PIN"
                maxLength={8}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyPin()}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleVerifyPin} disabled={pinLoading || !pinInput}>
                {pinLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Verify
              </Button>
              <Button variant="outline" onClick={() => { setShowUnlockPin(false); setPinInput(""); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Set PIN Card */}
      {showSetPin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Add PIN To Protect
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Set a 4-8 digit PIN to protect SMTP settings from unauthorized changes.
            </p>
            <div className="grid gap-4 max-w-xs">
              <div className="space-y-2">
                <Label>PIN (4-8 digits)</Label>
                <Input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="Enter PIN"
                  maxLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm PIN</Label>
                <Input
                  type="password"
                  value={pinConfirm}
                  onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="Confirm PIN"
                  maxLength={8}
                  onKeyDown={(e) => e.key === "Enter" && handleSetPin()}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSetPin} disabled={pinLoading}>
                {pinLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                Set PIN
              </Button>
              <Button variant="outline" onClick={() => { setShowSetPin(false); setPinInput(""); setPinConfirm(""); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Remove PIN Card */}
      {showRemovePin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldOff className="h-4 w-4" /> Remove Protection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 max-w-xs">
              <Label>Enter current PIN to remove protection</Label>
              <Input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="Current PIN"
                maxLength={8}
                onKeyDown={(e) => e.key === "Enter" && handleRemovePin()}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={handleRemovePin} disabled={pinLoading || !pinInput}>
                {pinLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldOff className="h-4 w-4 mr-2" />}
                Remove Protection
              </Button>
              <Button variant="outline" onClick={() => { setShowRemovePin(false); setPinInput(""); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SMTP Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" /> SMTP Configuration
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Protect / Unprotect buttons */}
              {editable && !isProtected && !showSetPin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowSetPin(true); setPinInput(""); setPinConfirm(""); }}
                >
                  <Lock className="h-3.5 w-3.5 mr-1.5" /> Protect this settings
                </Button>
              )}
              {editable && isProtected && !showRemovePin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowRemovePin(true); setPinInput(""); }}
                >
                  <ShieldOff className="h-3.5 w-3.5 mr-1.5" /> Unprotect
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={!editable ? "opacity-50 pointer-events-none select-none" : ""}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>SMTP Host</Label>
              <Input
                value={smtp.host}
                onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                placeholder="smtp.example.com"
                disabled={!editable}
              />
            </div>
            <div className="space-y-2">
              <Label>Port</Label>
              <Input
                value={smtp.port}
                onChange={(e) => setSmtp({ ...smtp, port: e.target.value })}
                placeholder="587"
                disabled={!editable}
              />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={smtp.username}
                onChange={(e) => setSmtp({ ...smtp, username: e.target.value })}
                autoComplete="off"
                disabled={!editable}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={smtp.password}
                onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
                autoComplete="new-password"
                disabled={!editable}
              />
            </div>
            <div className="space-y-2">
              <Label>From Email</Label>
              <Input
                value={smtp.fromEmail}
                onChange={(e) => setSmtp({ ...smtp, fromEmail: e.target.value })}
                placeholder="noreply@company.com"
                disabled={!editable}
              />
            </div>
            <div className="space-y-2">
              <Label>From Name</Label>
              <Input
                value={smtp.fromName}
                onChange={(e) => setSmtp({ ...smtp, fromName: e.target.value })}
                disabled={!editable}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={smtp.secure}
              onCheckedChange={(v) => setSmtp({ ...smtp, secure: v })}
              disabled={!editable}
            />
            <Label>Use TLS/SSL (secure)</Label>
          </div>
          </div>

          {/* SMTP Test Button + Result */}
          <Separator />
          <div className="flex items-center gap-4 flex-wrap">
            <Button variant="outline" onClick={testSmtp} disabled={testing || !smtp.host}>
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              {testing ? "Testing..." : "Test SMTP Connection"}
            </Button>

            {testResult && (
              <div
                className={`flex items-center gap-2 text-sm font-medium ${
                  testResult.success
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {testResult.success ? (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    Connected to Server
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5" />
                    Failed to Connect to Server
                    {testResult.error && (
                      <span className="text-xs font-normal text-muted-foreground ml-1">
                        ({testResult.error})
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
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

      <div className={!editable ? "space-y-4 opacity-50 pointer-events-none select-none" : "space-y-4"}>
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
                      disabled={!editable}
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
                  disabled={!event.enabled || !editable}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
