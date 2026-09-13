"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
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

const SYSTEM_COLORS: { value: SystemColor; label: string }[] = [
  { value: "blue", label: "Biru" },
  { value: "purple", label: "Ungu" },
  { value: "green", label: "Hijau" },
  { value: "cyan", label: "Cyan" },
];

export default function PreferencesPage() {
  const { theme, setTheme } = useTheme();
  const { navLayout, setNavLayout, systemColor, setSystemColor } = usePreferences();
  const [mounted, setMounted] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setMounted(true);
      setSoundMuted(isNotificationSoundMuted());
    });

    return () => cancelAnimationFrame(frame);
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
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Preferences"
        description="Layout, theme, system color, and notification sound"
        icon={<Settings2 className="h-6 w-6" />}
        backAction={
          <Button variant="ghost" size="icon" asChild>
            <Link href="/" aria-label="Back to dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

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
          <RadioGroup.Root
            name="navigation-layout"
            value={navLayout}
            onValueChange={(value) => setNavLayout(value as NavLayout)}
            aria-label="Navigation bar layout"
            className="grid gap-3 sm:grid-cols-3"
          >
            {LAYOUTS.map((layout) => {
              const Icon = layout.icon;
              const active = navLayout === layout.value;
              return (
                <RadioGroup.Item
                  key={layout.value}
                  value={layout.value}
                  aria-label={`${layout.label}: ${layout.description}`}
                  className={cn(
                    "pref-nav-option flex cursor-pointer flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    active
                      ? "pref-nav-option-active border-primary/50 bg-accent ring-1 ring-ring/20"
                      : "border-border bg-background hover:border-primary/30 hover:bg-accent/50"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 stroke-[2.25]",
                      active ? "text-primary" : "text-foreground"
                    )}
                  />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{layout.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{layout.description}</p>
                  </div>
                  <RadioGroup.Indicator className="text-[11px] font-semibold text-primary">
                    Active
                  </RadioGroup.Indicator>
                </RadioGroup.Item>
              );
            })}
          </RadioGroup.Root>
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
                    ? "bg-slate-800 border-slate-600 text-primary"
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
                    ? "text-primary"
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
          <RadioGroup.Root
            name="system-color"
            value={systemColor}
            onValueChange={(value) => setSystemColor(value as SystemColor)}
            aria-label="System color"
            className="grid gap-3 sm:grid-cols-2"
          >
            {SYSTEM_COLORS.map((color) => {
              const active = systemColor === color.value;
              return (
                <div key={color.value} data-system-color={color.value}>
                  <RadioGroup.Item
                    value={color.value}
                    aria-label={`${color.label}: Soft hover and solid button`}
                    className={cn(
                      "pref-nav-option flex w-full cursor-pointer items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      active
                        ? "pref-nav-option-active border-primary/50 bg-accent ring-1 ring-ring/20"
                        : "border-border bg-background hover:border-primary/30 hover:bg-accent/50"
                    )}
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border shadow-sm"
                      aria-hidden
                    >
                      <span className="h-full w-1/2 bg-[var(--sys-100)]" />
                      <span className="h-full w-1/2 bg-[var(--sys-600)]" />
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        {color.label}
                        <RadioGroup.Indicator className="text-[11px] font-semibold text-primary">
                          Active
                        </RadioGroup.Indicator>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Soft hover · solid button
                      </p>
                    </div>
                    <span
                      className="ml-auto h-4 w-4 shrink-0 rounded-full border border-white/40 bg-[var(--sys-700)] shadow"
                      aria-hidden
                    />
                  </RadioGroup.Item>
                </div>
              );
            })}
          </RadioGroup.Root>
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
