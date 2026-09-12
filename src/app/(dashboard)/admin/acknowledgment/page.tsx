"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useToast } from "@/components/ui/toast";
import { Save } from "lucide-react";

interface AckSettings {
  enabled: boolean;
  message: string;
}

const DEFAULT_MSG = `<p>Dear {{displayName}},</p>
<p>An asset has been assigned to you:</p>
<ul>
<li><strong>Asset:</strong> {{assetName}}</li>
<li><strong>Tag:</strong> {{assetTag}}</li>
</ul>
<p>Please acknowledge receipt. Contact IT Support if you have questions.</p>
<p>Regards,<br/>IT Asset Management</p>`;

export default function AcknowledgmentPage() {
  const { toast } = useToast();
  const [form, setForm] = useState<AckSettings>({ enabled: false, message: DEFAULT_MSG });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings?key=acknowledgmentForm")
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setForm({ enabled: !!d.data.enabled, message: d.data.message || DEFAULT_MSG });
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "acknowledgmentForm", value: form }),
      });
      const data = await res.json();
      if (data.success) toast({ title: "Acknowledgment form saved", variant: "success" });
      else toast({ title: data.error || "Failed", variant: "destructive" });
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
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Acknowledgment Form</h1>
          <p className="text-muted-foreground">
            Auto-send email when an asset is assigned to a user
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Enable auto email on assign</CardTitle>
            <div className="flex items-center gap-2">
              <Label>{form.enabled ? "On" : "Off"}</Label>
              <Switch
                checked={form.enabled}
                onCheckedChange={(v) => setForm({ ...form, enabled: v })}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label>Message template (rich text)</Label>
          <p className="text-xs text-muted-foreground">
            Variables: {"{{displayName}}"}, {"{{assetName}}"}, {"{{assetTag}}"}, {"{{serialNumber}}"}
          </p>
          <RichTextEditor
            value={form.message}
            onChange={(html) => setForm({ ...form, message: html })}
            minHeight="220px"
            editable={form.enabled}
            placeholder="Email body when asset is assigned..."
          />
        </CardContent>
      </Card>
    </div>
  );
}
