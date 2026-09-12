"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useBrand } from "@/components/providers/brand-provider";
import { toBrandMediaUrl } from "@/lib/public-assets";
import { ImportOverlay } from "@/components/ui/import-overlay";
import {
  DEFAULT_ICON,
  DEFAULT_LOGO,
  SYSTEM_FONTS,
  isDefaultIcon,
  isDefaultLogo,
  systemFontStack,
} from "@/lib/public-assets";
import { Save, Palette, Upload, ImageIcon, X, Type, AppWindow } from "lucide-react";

interface Appearance {
  appName: string;
  logo: string;
  icon: string;
  font: string;
  fontUrl?: string;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_FONT_BYTES = 2 * 1024 * 1024;
const IMAGE_ACCEPT = ".png,.jpg,.jpeg,.avif,image/png,image/jpeg,image/avif";
const FONT_ACCEPT = ".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2";
const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "avif"]);
const FONT_EXT = new Set(["ttf", "otf", "woff", "woff2"]);

function getExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export default function AppearancePage() {
  const { toast } = useToast();
  const { refreshBrand } = useBrand();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Appearance>({
    appName: "NexusDesk",
    logo: DEFAULT_LOGO,
    icon: DEFAULT_ICON,
    font: "Inter",
    fontUrl: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "icon" | "font" | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await fetch("/api/settings?key=appearance");
      const data = await res.json();
      if (data.data) {
        setForm((prev) => ({
          ...prev,
          ...data.data,
          logo: toBrandMediaUrl(data.data.logo || DEFAULT_LOGO),
          icon: toBrandMediaUrl(data.data.icon || data.data.logo || DEFAULT_ICON),
          font: data.data.font || "Inter",
          fontUrl: data.data.fontUrl || "",
        }));
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "appearance", value: form }),
      });
      const data = await res.json();
      if (data.success) {
        await refreshBrand();
        toast({
          title: "Appearance saved",
          description: "Applied to login, navbar, title icon, and system font",
          variant: "success",
        });
      } else {
        toast({ title: data.error || "Failed to save", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
    setSaving(false);
  }

  function validateImage(file: File): string | null {
    if (file.size <= 0) return "Empty file";
    if (file.size > MAX_IMAGE_BYTES) return "File too large. Maximum size is 5MB.";
    const ext = getExt(file.name);
    if (!IMAGE_EXT.has(ext)) return "Invalid file type. Only PNG, JPG, JPEG, and AVIF are allowed.";
    const mime = (file.type || "").toLowerCase();
    if (mime && !["image/png", "image/jpeg", "image/jpg", "image/avif"].includes(mime)) {
      return "Invalid file type. Only PNG, JPG, JPEG, and AVIF are allowed.";
    }
    return null;
  }

  function validateFont(file: File): string | null {
    if (file.size <= 0) return "Empty file";
    if (file.size > MAX_FONT_BYTES) return "Font file too large. Maximum size is 2MB.";
    const ext = getExt(file.name);
    if (!FONT_EXT.has(ext)) return "Invalid font type. Only TTF, OTF, WOFF, and WOFF2 are allowed.";
    return null;
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
      const data = await res.json();
      if (data.success && data.data?.[kind]) {
        setForm((prev) => ({ ...prev, [kind]: data.data[kind] }));
        await refreshBrand();
        toast({
          title: kind === "icon" ? "App icon uploaded" : "App logo uploaded",
          variant: "success",
        });
      } else {
        toast({ title: data.error || "Upload failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    setUploading(null);
  }

  async function uploadFont(file: File) {
    const err = validateFont(file);
    if (err) {
      toast({ title: err, variant: "destructive" });
      return;
    }
    setUploading("font");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", "font");
      const res = await fetch("/api/brand/upload", { method: "POST", body });
      const data = await res.json();
      if (data.success && data.data?.font) {
        setForm((prev) => ({
          ...prev,
          font: data.data.font,
          fontUrl: data.data.fontUrl || "",
        }));
        await refreshBrand();
        toast({
          title: "Font uploaded",
          description: `"${data.data.font}" applied system-wide`,
          variant: "success",
        });
      } else {
        toast({ title: data.error || "Upload failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    setUploading(null);
  }

  function onSelectFont(v: string) {
    // Selecting a built-in font clears custom fontUrl
    setForm((prev) => ({
      ...prev,
      font: v,
      fontUrl: "",
    }));
  }

  if (loading) {
    return (
      <div className="flex justify-center h-64 items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const busy = saving || uploading !== null;
  const previewFont = form.fontUrl
    ? `"${form.font}", system-ui, sans-serif`
    : systemFontStack(form.font);

  return (
    <div className="max-w-2xl space-y-6">
      <ImportOverlay
        open={uploading !== null}
        kind={uploading === "font" ? "generic" : "image"}
        label={
          uploading === "logo"
            ? "Uploading logo…"
            : uploading === "icon"
              ? "Uploading app icon…"
              : uploading === "font"
                ? "Uploading font…"
                : "Uploading…"
        }
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Appearance</h1>
          <p className="text-muted-foreground">Customize application branding for all users</p>
        </div>
        <Button onClick={save} disabled={busy}>
          <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4" /> Branding
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Application Name</Label>
            <Input
              value={form.appName}
              onChange={(e) => setForm({ ...form, appName: e.target.value })}
              placeholder="NexusDesk"
            />
          </div>

          {/* App Logo */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" /> App Logo
            </Label>
            <p className="text-xs text-muted-foreground">
              Shown on login, sidebar, and top bar. PNG, JPG, JPEG, or AVIF. Max 5MB.
            </p>
            <input
              ref={logoInputRef}
              type="file"
              accept={IMAGE_ACCEPT}
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void uploadImage("logo", f);
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => logoInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading === "logo" ? "Uploading..." : "Upload Logo"}
              </Button>
              {!isDefaultLogo(form.logo) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setForm((p) => ({ ...p, logo: DEFAULT_LOGO }))}
                >
                  <X className="h-4 w-4 mr-1" /> Reset
                </Button>
              )}
            </div>
            <div className="mt-2 p-4 border rounded-lg bg-muted/30 flex items-center justify-center min-h-[88px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={form.logo}
                src={form.logo}
                alt="App logo preview"
                className="max-h-16 w-auto object-contain"
              />
            </div>
          </div>

          {/* App Icon */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <AppWindow className="h-4 w-4" /> App Icon
            </Label>
            <p className="text-xs text-muted-foreground">
              Used as browser tab / title favicon. PNG, JPG, JPEG, or AVIF. Max 5MB.
            </p>
            <input
              ref={iconInputRef}
              type="file"
              accept={IMAGE_ACCEPT}
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void uploadImage("icon", f);
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => iconInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading === "icon" ? "Uploading..." : "Upload Icon"}
              </Button>
              {!isDefaultIcon(form.icon) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setForm((p) => ({ ...p, icon: DEFAULT_ICON }))}
                >
                  <X className="h-4 w-4 mr-1" /> Reset
                </Button>
              )}
            </div>
            <div className="mt-2 p-4 border rounded-lg bg-muted/30 flex items-center gap-3 min-h-[72px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={form.icon}
                src={form.icon}
                alt="App icon preview"
                className="h-10 w-10 object-contain rounded"
              />
              <span className="text-sm text-muted-foreground">Tab title icon preview</span>
            </div>
          </div>

          {/* Font System */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Type className="h-4 w-4" /> Font System
            </Label>
            <p className="text-xs text-muted-foreground">
              Applied globally across the whole app after save / upload.
            </p>
            <Select
              value={SYSTEM_FONTS.includes(form.font as (typeof SYSTEM_FONTS)[number]) ? form.font : form.font}
              onValueChange={onSelectFont}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select font" />
              </SelectTrigger>
              <SelectContent>
                {SYSTEM_FONTS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
                {form.fontUrl && form.font && !SYSTEM_FONTS.includes(form.font as (typeof SYSTEM_FONTS)[number]) && (
                  <SelectItem value={form.font}>{form.font} (uploaded)</SelectItem>
                )}
              </SelectContent>
            </Select>

            <input
              ref={fontInputRef}
              type="file"
              accept={FONT_ACCEPT}
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void uploadFont(f);
              }}
            />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => fontInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading === "font" ? "Uploading..." : "Upload Font"}
              </Button>
              {form.fontUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setForm((p) => ({ ...p, font: "Inter", fontUrl: "" }))}
                >
                  <X className="h-4 w-4 mr-1" /> Use Inter
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Font upload: TTF, OTF, WOFF, WOFF2 — max 2MB.
              {form.fontUrl ? ` Active custom: ${form.font}` : ""}
            </p>
          </div>

          <div className="rounded-lg border p-4 bg-muted/20">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <div className="flex items-center gap-3" style={{ fontFamily: previewFont }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.logo}
                alt=""
                className="h-[60px] w-auto max-w-[160px] object-contain"
              />
              <div>
                <span className="font-bold text-lg block">{form.appName || "NexusDesk"}</span>
                <span className="text-sm text-muted-foreground">
                  The quick brown fox jumps over the lazy dog
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
