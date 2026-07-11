"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { useBrand } from "@/components/providers/brand-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, logout } = useAuth();
  const { appName, logo } = useBrand();
  const router = useRouter();
  const { toast } = useToast();

  const forced = Boolean(user?.mustChangePassword);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!currentPassword) {
      toast({ title: "Current password is required", variant: "destructive" });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }

    if (newPassword.length < 8 || !/(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
      toast({
        title: "Password must be 8+ characters with letters and numbers",
        variant: "destructive",
      });
      return;
    }

    if (newPassword === currentPassword) {
      toast({
        title: "New password must be different from your current password",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (data.success) {
        toast({
          title: "Password changed",
          description: "Please sign in again with your new password.",
          variant: "success",
        });
        // Clear client auth state; session cookie already cleared by API
        try {
          await fetch("/api/auth/me", { method: "DELETE" });
        } catch {
          /* ignore */
        }
        // Hard navigate so auth context resets cleanly
        window.location.href = "/login?passwordChanged=1";
        return;
      }
      toast({ title: data.error || "Failed to change password", variant: "destructive" });
    } catch {
      toast({ title: "Error changing password", variant: "destructive" });
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo}
            alt={appName}
            className="h-[84px] sm:h-[100px] w-auto max-w-[280px] sm:max-w-[340px] object-contain"
          />
          <p className="font-bold text-xl tracking-tight">{appName}</p>
        </div>
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{forced ? "Set a new password" : "Change Password"}</CardTitle>
            <CardDescription>
              {forced
                ? "For security, you must change your temporary password before continuing. You will sign in again after this."
                : "Update your password. You will be signed out and must log in again."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current">
                  {forced ? "Current / temporary password" : "Current Password"}
                </Label>
                <Input
                  id="current"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new">New Password</Label>
                <Input
                  id="new"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="Min 8 chars, letters + numbers"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm New Password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                New password cannot be the same as your current password.
              </p>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Changing..." : "Change Password & Sign In Again"}
              </Button>
              {!forced && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => router.back()}
                  disabled={loading}
                >
                  Cancel
                </Button>
              )}
              {forced && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => logout()}
                  disabled={loading}
                >
                  Sign out
                </Button>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
