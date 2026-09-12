"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/components/providers/auth-provider";
import { getInitials, formatDateTime } from "@/lib/utils";
import { KeyRound, Mail, Building, Briefcase, Shield, Phone, User, MapPin, Settings2 } from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?._id) {
      fetch(`/api/users/${user._id}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setDetails(d.data);
        })
        .finally(() => setLoading(false));
    } else setLoading(false);
  }, [user]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const fields = [
    { icon: Mail, label: "Email", value: user.email },
    { icon: User, label: "Username", value: user.username },
    { icon: Briefcase, label: "Job Title", value: (details?.jobTitle as string) || "—" },
    { icon: Building, label: "Department", value: (details?.department as string) || user.department || "—" },
    { icon: Shield, label: "Employee ID", value: (details?.employeeId as string) || "—" },
    { icon: Phone, label: "Mobile", value: (details?.mobile as string) || "—" },
    { icon: MapPin, label: "Site", value: (details?.site as string) || user.site || "—" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile & Preferences</h1>
        <p className="text-muted-foreground">Account info and UI personalization</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="text-2xl bg-blue-600 text-white dark:bg-blue-600 dark:text-white">
                {getInitials(user.displayName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-bold">{user.displayName}</h2>
              <p className="text-muted-foreground">@{user.username}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant={user.role === "SuperAdmin" ? "default" : "secondary"}>{user.role}</Badge>
                {user.userTypes.map((t) => (
                  <Badge key={t} variant="outline">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.label} className="flex items-center gap-3">
                <div className="rounded-md bg-muted p-2">
                  <f.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{f.label}</p>
                  <p className="text-sm font-medium">{f.value}</p>
                </div>
              </div>
            ))}
          </div>

          {details?.lastLogin ? (
            <>
              <Separator className="my-6" />
              <p className="text-xs text-muted-foreground">
                Last login: {formatDateTime(details.lastLogin as string)}
              </p>
            </>
          ) : null}

          <Separator className="my-6" />
          <Link href="/change-password">
            <Button variant="outline">
              <KeyRound className="h-4 w-4 mr-2" /> Change Password
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-4 w-4" /> App Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Navigation layout, theme, and notification sound.
          </p>
          <Link href="/preferences">
            <Button variant="outline">
              <Settings2 className="h-4 w-4 mr-2" /> Open Preferences
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
