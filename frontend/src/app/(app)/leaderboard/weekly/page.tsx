"use client";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function WeeklyLeaderboardPage() {
  return (
    <PageTransition>
      <PageHeader title="Weekly Competition" description="May 26 - Jun 1, 2026" />
      <Card className="p-4 mb-6 text-center"><p className="text-xs text-muted-foreground">Prize Pool</p><p className="text-2xl font-mono font-bold mt-1">50 STT</p></Card>
      <Card className="p-6 text-center text-sm text-muted-foreground">Competition starts when markets are active. Check back soon.</Card>
    </PageTransition>
  );
}
