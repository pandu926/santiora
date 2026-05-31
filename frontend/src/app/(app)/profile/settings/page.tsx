"use client";

import { Bell, MonitorCog, ShieldCheck, SlidersHorizontal } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { PageTransition } from "@/components/shared/PageTransition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PreferenceItem {
  label: string;
  description: string;
  enabled: boolean;
}

const displayPreferences: PreferenceItem[] = [
  { label: "Compact market tables", description: "Reduce vertical spacing for data-dense trading views.", enabled: true },
  { label: "Show implied probability", description: "Display probability next to YES/NO prices.", enabled: true },
  { label: "Reduce motion", description: "Minimize animated transitions across the app.", enabled: false },
];

const notificationPreferences: PreferenceItem[] = [
  { label: "Market resolved", description: "Notify when a position becomes claimable.", enabled: true },
  { label: "Odds movement", description: "Alert when watched markets move more than 10%.", enabled: false },
  { label: "AI market creation", description: "Notify when agents create markets in favorite categories.", enabled: true },
];

function PreferenceRow({ item }: { item: PreferenceItem }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0">
      <div>
        <div className="font-medium">{item.label}</div>
        <div className="text-sm text-muted-foreground">{item.description}</div>
      </div>
      <Button variant={item.enabled ? "default" : "outline"} size="sm" className="min-w-16">
        {item.enabled ? "On" : "Off"}
      </Button>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <PageTransition>
      <PageHeader title="Settings" description="Display and notification preferences for trading workflows" />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <MonitorCog className="size-4" />
                Display Preferences
              </CardTitle>
              <Badge variant="outline">Placeholder</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {displayPreferences.map((item) => (
              <PreferenceRow key={item.label} item={item} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Bell className="size-4" />
                Notification Preferences
              </CardTitle>
              <Badge variant="outline">Placeholder</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {notificationPreferences.map((item) => (
              <PreferenceRow key={item.label} item={item} />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4" />
            Protocol Safety
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <SlidersHorizontal className="size-4" />
            Preferences are local-only placeholders until wallet-backed settings are enabled.
          </div>
          <Button variant="outline">Save Preferences</Button>
        </CardContent>
      </Card>
    </PageTransition>
  );
}
