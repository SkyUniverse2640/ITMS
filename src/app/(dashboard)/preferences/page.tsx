"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  usePreferences,
  type SystemColor,
} from "@/components/providers/preferences-provider";
import type { NavLayout } from "@/lib/nav-config";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  LayoutDashboard,
  Moon,
  Palette,
  PanelBottom,
  PanelLeft,
  PanelTop,
  Settings2,
  Sun,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  isNotificationSoundMuted,
  playNotificationSound,
  setNotificationSoundMuted,
  unlockNotificationSound,
} from "@/lib/notification-sound";

const LAYOUTS: { value: NavLayout; label: string; description: string; icon: typeof PanelLeft }[] = [
  {
    value: "sidebar",
    label: "Sidebar",
    description: "Menu navigasi di sisi kiri",
    icon: PanelLeft,
  },
  {
    value: "top",
    label: "Top bar",
    description: "Menu navigasi di atas",
    icon: PanelTop,
  },
  {
    value: "bottom",
    label: "Bottom bar",
    description: "Menu navigasi di bawah",
    icon: PanelBottom,
  },
];

/** Soft (50) / mid (600) swatches matching CSS system palettes */
const SYSTEM_COLORS: {
  value: SystemColor;
  label: string;
  soft: string;
  mid: string;
  hard: string;
}[] = [
  { value: "blue", label: "Biru", soft: "#dbeafe", mid: "#2563eb", hard: "#1d4ed8" },
  { value: "purple", label: "Ungu", soft: "#f3e8ff", mid: "#9333ea", hard: "#7e22ce" },
  { value: "green", label: "Hijau", soft: "#dcfce7", mid: "#16a34a", hard: "#15803d" },
  { value: "cyan", label: "Cyan", soft: "#cffafe", mid: "#0891b2", hard: "#0e7490" },
];

export default function PreferencesPage() {
  const { theme, setTheme } = useTheme();
  const { navLayout, setNavLayout, systemColor, setSystemColor } = usePreferences();
  const [mounted, setMounted] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setSoundMuted(isNotificationSoundMuted());
  }, []);

  function onSoundToggle(enabled: boolean) {
    // Switch ON = sound enabled (not muted)
    setSoundMuted(!enabled);
    setNotificationSoundMuted(!enabled);
    if (enabled) {
      unlockNotificationSound();
      playNotificationSound();
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <Link href="/">
          <Button variant="ghost" size="icon" title="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings2 className="h-6 w-6" />
            Preferences
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Layout, theme, system color, and notification sound
          </p>
        </div>
      </div>

      {/* 1. Navigation Bar Layout */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Navigation Bar Layout
          </CardTitle>
          <CardDescription>Pilih posisi menu navigasi. Tersimpan di perangkat ini.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {LAYOUTS.map((l) => {
              const Icon = l.icon;
              const active = navLayout === l.value;
              return (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setNavLayout(l.value)}
                  className={cn(
                    "pref-nav-option flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors cursor-pointer",
                    active
                      ? "pref-nav-option-active border-blue-400 bg-blue-50 ring-2 ring-blue-400/25 dark:bg-blue-950/40 dark:border-blue-500"
                      : "border-border bg-background"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 stroke-[2.25]",
                      active ? "text-blue-600 dark:text-blue-300" : "text-foreground"
                    )}
                  />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{l.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{l.description}</p>
                  </div>
                  {active && (
                    <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-300">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 2. Toggle Theme */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {mounted && theme === "dark" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
            Toggle Theme
          </CardTitle>
          <CardDescription>Ganti tampilan light atau dark mode.</CardDescription>
        </CardHeader>
        <CardContent>
          <label
            htmlFor="theme-toggle"
            className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 px-4 py-3.5 cursor-pointer transition-colors hover:bg-accent/40"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-sm",
                  mounted && theme === "dark"
                    ? "bg-slate-800 border-slate-600 text-blue-300"
                    : "bg-amber-50 border-amber-200 text-amber-500 dark:bg-amber-950/40 dark:border-amber-800"
                )}
              >
                {mounted && theme === "dark" ? (
                  <Moon className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-none">
                  {mounted && theme === "dark" ? "Dark mode" : "Light mode"}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-snug">
                  {mounted && theme === "dark"
                    ? "Tema gelap aktif"
                    : "Tema terang aktif"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <Sun
                className={cn(
                  "h-[18px] w-[18px] transition-colors",
                  mounted && theme !== "dark"
                    ? "text-amber-500"
                    : "text-muted-foreground/40"
                )}
                aria-hidden
              />
              {mounted ? (
                <Switch
                  id="theme-toggle"
                  checked={theme === "dark"}
                  onCheckedChange={(on) => setTheme(on ? "dark" : "light")}
                  aria-label="Toggle light or dark theme"
                />
              ) : (
                <div className="h-8 w-14 rounded-full bg-muted animate-pulse" />
              )}
              <Moon
                className={cn(
                  "h-[18px] w-[18px] transition-colors",
                  mounted && theme === "dark"
                    ? "text-blue-400"
                    : "text-muted-foreground/40"
                )}
                aria-hidden
              />
            </div>
          </label>
        </CardContent>
      </Card>

      {/* 3. System Color */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4" />
            System Color
          </CardTitle>
          <CardDescription>
            Warna aksen aplikasi (tombol, nav aktif, hover, primary). Soft / hard mengikuti skala yang
            sama seperti biru default.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {SYSTEM_COLORS.map((c) => {
              const active = systemColor === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setSystemColor(c.value)}
                  className={cn(
                    "pref-nav-option flex items-center gap-3 rounded-lg border p-3 text-left transition-colors cursor-pointer",
                    active
                      ? "pref-nav-option-active border-blue-400 ring-2 ring-blue-400/25 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-500"
                      : "border-border bg-background"
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border shadow-sm">
                    <span className="w-1/2 h-full" style={{ backgroundColor: c.soft }} title="soft" />
                    <span className="w-1/2 h-full" style={{ backgroundColor: c.mid }} title="hard" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                      {c.label}
                      {active && (
                        <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-300">
                          Active
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Soft hover · solid button
                    </p>
                  </div>
                  <span
                    className="ml-auto h-4 w-4 shrink-0 rounded-full border border-white/40 shadow"
                    style={{ backgroundColor: c.hard }}
                    title="primary"
                  />
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 4. Notification Sound */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {soundMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
            Notification Sound
          </CardTitle>
          <CardDescription>
            Bunyi chime saat ada notifikasi baru.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label
            htmlFor="notification-sound"
            className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 px-4 py-3.5 cursor-pointer transition-colors hover:bg-accent/40"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-sm",
                  soundMuted
                    ? "bg-muted border-border text-muted-foreground"
                    : "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400"
                )}
              >
                {soundMuted ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-none">
                  Sound {soundMuted ? "Off" : "On"}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-snug">
                  {soundMuted
                    ? "Notifikasi diam (tanpa suara)"
                    : "Notifikasi berbunyi · On memutar preview"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <VolumeX
                className={cn(
                  "h-[18px] w-[18px] transition-colors",
                  soundMuted ? "text-muted-foreground" : "text-muted-foreground/40"
                )}
                aria-hidden
              />
              <Switch
                id="notification-sound"
                checked={!soundMuted}
                onCheckedChange={onSoundToggle}
                aria-label="Notification sound on or off"
              />
              <Volume2
                className={cn(
                  "h-[18px] w-[18px] transition-colors",
                  !soundMuted
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground/40"
                )}
                aria-hidden
              />
            </div>
          </label>
        </CardContent>
      </Card>
    </div>
  );
}
