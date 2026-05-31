"use client";

import { useEffect, useState } from "react";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { fetchAnalytics, AnalyticsData } from "@/lib/api";
import { AnimatedList, AnimatedItem } from "@/components/shared/Animations";

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    fetchAnalytics().then(setData).catch(() => {});
  }, []);

  const stats = [
    { label: "Total Markets", value: data?.totalMarkets ?? 0 },
    { label: "24h Volume", value: `${data?.volume24h?.toFixed(0) ?? 0} STT` },
    { label: "Total Users", value: data?.uniqueUsers ?? 0 },
    { label: "Total Bets", value: data?.totalBets ?? 0 },
    { label: "Resolutions", value: data?.totalResolutions ?? 0 },
    { label: "Avg Confidence", value: `${data?.avgConfidence ?? 0}%` },
  ];

  return (
    <PageTransition>
      <PageHeader title="Analytics" description="Protocol performance metrics — live from backend" />
      <AnimatedList className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {stats.map(s => (
          <AnimatedItem key={s.label}>
            <Card className="p-4 text-center">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-mono font-bold mt-1">{s.value}</p>
            </Card>
          </AnimatedItem>
        ))}
      </AnimatedList>
    </PageTransition>
  );
}
