"use client";
import { useEffect, useState } from "react";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { fetchAnalytics } from "@/lib/api";

export default function AccuracyPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchAnalytics().then(setData).catch(() => {});
  }, []);

  return (
    <PageTransition>
      <PageHeader title="Resolution Accuracy" description="Historical AI resolution performance" />
      <Card className="p-6 text-center mb-6">
        <p className="text-xs text-muted-foreground">Overall Accuracy</p>
        <p className="text-4xl font-mono font-bold text-success mt-2">{data?.avgConfidence ?? 0}%</p>
        <p className="text-xs text-muted-foreground mt-1">{data?.totalResolutions ?? 0} resolutions</p>
      </Card>
      {data?.totalResolutions === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">Accuracy data will appear after markets are resolved by AI.</Card>
      )}
    </PageTransition>
  );
}
