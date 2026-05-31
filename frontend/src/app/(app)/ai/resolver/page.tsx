"use client";
import { useEffect, useState } from "react";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle } from "lucide-react";
import { fetchAnalytics, fetchAIActivity } from "@/lib/api";

export default function AIResolverPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    fetchAnalytics().then(setAnalytics).catch(() => {});
    fetchAIActivity().then(d => setActivities(d.activities.filter((a: any) => a.action?.includes("resolution") || a.agent?.includes("resolver")))).catch(() => {});
  }, []);

  return (
    <PageTransition>
      <PageHeader title="AI Resolver" description="Deterministic consensus resolution — 3 validators must agree" />
      <div className="grid md:grid-cols-3 gap-3 mb-8">
        <Card className="p-4 text-center"><p className="text-xs text-muted-foreground">Total Resolutions</p><p className="text-2xl font-mono font-bold mt-1">{analytics?.totalResolutions ?? 0}</p></Card>
        <Card className="p-4 text-center"><p className="text-xs text-muted-foreground">Avg Confidence</p><p className="text-2xl font-mono font-bold mt-1">{analytics?.avgConfidence ?? 0}%</p></Card>
        <Card className="p-4 text-center"><p className="text-xs text-muted-foreground">Consensus Model</p><p className="text-2xl font-mono font-bold mt-1">3/3</p></Card>
      </div>
      <h2 className="text-sm font-semibold mb-3">How It Works</h2>
      <Card className="p-4 mb-6 space-y-2">
        <div className="flex items-center gap-2 text-xs"><CheckCircle className="w-3.5 h-3.5 text-success" /><span>3 independent AI validators scrape and verify</span></div>
        <div className="flex items-center gap-2 text-xs"><CheckCircle className="w-3.5 h-3.5 text-success" /><span>Minimum 80% confidence required to resolve</span></div>
        <div className="flex items-center gap-2 text-xs"><CheckCircle className="w-3.5 h-3.5 text-success" /><span>Below threshold → delay and retry with more sources</span></div>
      </Card>
      {activities.length > 0 && (
        <>
          <h2 className="text-sm font-semibold mb-3">Recent Resolution Activity</h2>
          <Card className="divide-y">
            {activities.slice(0, 5).map((a, i) => (
              <div key={i} className="px-4 py-3 flex justify-between text-sm">
                <span>{a.desc || a.action}</span>
                <span className="text-xs text-muted-foreground">{new Date(a.time).toLocaleTimeString()}</span>
              </div>
            ))}
          </Card>
        </>
      )}
      {analytics?.totalResolutions === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground mt-4">No resolutions yet. Markets will be resolved automatically when their deadlines pass.</Card>
      )}
    </PageTransition>
  );
}
