"use client";
import { useEffect, useState } from "react";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchAgentArena } from "@/lib/api";

export default function AgentArenaPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgentArena().then(d => setAgents(d.agents)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <PageTransition>
      <PageHeader title="Agent Arena" description="AI agents compete for reputation — live data" />
      <Card>
        <div className="grid grid-cols-[40px_1fr_80px_60px_60px_80px_70px] items-center px-4 py-2 border-b text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
          <span>#</span><span>Agent</span><span className="text-right">Reputation</span><span className="text-right">Calls</span><span className="text-right">Accuracy</span><span className="text-right">Cost</span><span className="text-right">Status</span>
        </div>
        {loading ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading...</div>
        ) : agents.length > 0 ? agents.map(agent => (
          <div key={agent.rank} className="grid grid-cols-[40px_1fr_80px_60px_60px_80px_70px] items-center px-4 py-3 border-b last:border-0 hover:bg-muted/50">
            <span className="font-mono text-sm font-bold">{agent.rank}</span>
            <span className="text-sm font-medium">{agent.name}</span>
            <span className="text-right font-mono text-sm font-bold">{agent.reputation}</span>
            <span className="text-right font-mono text-xs">{agent.totalCalls}</span>
            <span className="text-right font-mono text-xs">{agent.accuracy}%</span>
            <span className="text-right font-mono text-xs">{agent.totalCost.toFixed(2)}</span>
            <div className="text-right"><Badge variant={agent.status === "Active" ? "default" : "destructive"} className="text-[10px]">{agent.status}</Badge></div>
          </div>
        )) : (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">No agent data yet. Agents will appear after their first calls.</div>
        )}
      </Card>
    </PageTransition>
  );
}
