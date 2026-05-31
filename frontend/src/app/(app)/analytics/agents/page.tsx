"use client";
import { useEffect, useState } from "react";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { fetchAIStatus } from "@/lib/api";

export default function AgentAnalyticsPage() {
  const [agents, setAgents] = useState<any[]>([]);

  useEffect(() => {
    fetchAIStatus().then(d => setAgents(d.agents)).catch(() => {});
  }, []);

  return (
    <PageTransition>
      <PageHeader title="Agent Analytics" description="AI agent performance — live" />
      {agents.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-3">
          {agents.map(a => (
            <Card key={a.name} className="p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">{a.name}</span>
                <span className={`text-xs ${a.status === "Active" ? "text-success" : "text-destructive"}`}>{a.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div><p className="text-[10px] text-muted-foreground">Success Rate</p><p className="font-mono font-bold">{a.successRate}%</p></div>
                <div><p className="text-[10px] text-muted-foreground">24h Calls</p><p className="font-mono font-bold">{a.calls24h}</p></div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-6 text-center text-sm text-muted-foreground">Agent analytics will appear after agents start operating.</Card>
      )}
    </PageTransition>
  );
}
