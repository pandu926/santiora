"use client";

import { useState, useEffect } from "react";
import { PageTransition } from "@/components/shared/PageTransition";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Server, TrendingUp, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";

interface HealthData {
  checked_at: string;
  agents_alive: number;
  markets_created_today: number;
  budget_remaining: number;
  error_count_1h: number;
  scrape_success_rate: number;
  status: string;
}

interface MetricsData {
  total_markets: number;
  total_resolved: number;
  total_agent_calls: number;
  total_failures: number;
  success_rate_24h: number;
  stt_spent_today: number;
  uptime_hours: number;
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://santiora.rbexp.com/api";
    Promise.all([
      fetch(`${apiBase}/status/health`).then(r => r.json()).catch(() => null),
      fetch(`${apiBase}/status/metrics`).then(r => r.json()).catch(() => null),
    ]).then(([h, m]) => {
      setHealth(h);
      setMetrics(m);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <PageTransition>
        <div className="space-y-6">
          <h1 className="text-xl font-semibold">System Status</h1>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Card key={i} className="p-4 animate-pulse h-24" />)}
          </div>
        </div>
      </PageTransition>
    );
  }

  const statusColor = health?.status === "healthy" ? "text-green-600" : "text-orange-500";
  const StatusIcon = health?.status === "healthy" ? CheckCircle2 : AlertTriangle;

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">System Status</h1>
          <Badge variant={health?.status === "healthy" ? "default" : "destructive"} className="gap-1">
            <StatusIcon className="w-3 h-3" />
            {health?.status || "unknown"}
          </Badge>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-xs text-zinc-500">Success Rate</span>
            </div>
            <p className="text-2xl font-bold font-mono">{metrics?.success_rate_24h?.toFixed(1) || "0"}%</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-zinc-500">Markets Today</span>
            </div>
            <p className="text-2xl font-bold font-mono">{health?.markets_created_today || 0}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-zinc-500">STT Spent Today</span>
            </div>
            <p className="text-2xl font-bold font-mono">{metrics?.stt_spent_today?.toFixed(2) || "0"}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Server className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-zinc-500">Uptime</span>
            </div>
            <p className="text-2xl font-bold font-mono">{metrics?.uptime_hours || 0}h</p>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="p-5">
            <h3 className="text-sm font-medium mb-3">Lifetime Metrics</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-zinc-500">Total Markets</span><span className="font-mono">{metrics?.total_markets || 0}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Total Resolved</span><span className="font-mono">{metrics?.total_resolved || 0}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Agent Calls</span><span className="font-mono">{metrics?.total_agent_calls || 0}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Failures</span><span className="font-mono">{metrics?.total_failures || 0}</span></div>
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="text-sm font-medium mb-3">Current Health</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-zinc-500">Agents Alive</span><span className="font-mono">{health?.agents_alive || 0}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Errors (1h)</span><span className="font-mono">{health?.error_count_1h || 0}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Scrape Success</span><span className="font-mono">{health?.scrape_success_rate?.toFixed(1) || "0"}%</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Last Check</span><span className="font-mono text-xs">{health?.checked_at ? new Date(health.checked_at).toLocaleTimeString() : "--"}</span></div>
            </div>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}
