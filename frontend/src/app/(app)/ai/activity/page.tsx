"use client";

import { PageTransition } from "@/components/shared/PageTransition";
import { useAgentActivity, type ActivityItem } from "@/hooks/useAgentActivity";
import { Bot, Globe, Brain, BarChart3, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

const STEP_CONFIG: Record<string, { icon: typeof Bot; color: string; bgColor: string; label: string }> = {
  scraping: { icon: Globe, color: "text-blue-500", bgColor: "bg-blue-50", label: "Scraping Web" },
  generating_question: { icon: Brain, color: "text-purple-500", bgColor: "bg-purple-50", label: "Generating Question" },
  setting_odds: { icon: BarChart3, color: "text-amber-500", bgColor: "bg-amber-50", label: "Setting Odds" },
  creating_market: { icon: CheckCircle2, color: "text-green-500", bgColor: "bg-green-50", label: "Creating Market" },
  resolving: { icon: Brain, color: "text-indigo-500", bgColor: "bg-indigo-50", label: "Resolving Market" },
  complete: { icon: CheckCircle2, color: "text-green-600", bgColor: "bg-green-50", label: "Complete" },
};

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ActivityTimelineItem({ item }: { item: ActivityItem }) {
  const config = STEP_CONFIG[item.step] || { icon: Bot, color: "text-zinc-500", bgColor: "bg-zinc-50", label: item.step };
  const Icon = config.icon;
  const isActive = item.step !== "complete";

  return (
    <div className="flex gap-3 relative">
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center`}>
          {isActive ? (
            <Loader2 className={`w-4 h-4 ${config.color} animate-spin`} />
          ) : (
            <Icon className={`w-4 h-4 ${config.color}`} />
          )}
        </div>
        <div className="w-px h-full bg-zinc-200 mt-1" />
      </div>
      <div className="pb-6 flex-1">
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
          <span className="text-[10px] text-zinc-400 font-mono">{formatTime(item.timestamp)}</span>
        </div>
        <p className="text-sm text-zinc-700 mt-0.5">{item.detail}</p>
        {item.marketAddress && (
          <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">
            {item.marketAddress.slice(0, 10)}...{item.marketAddress.slice(-6)}
          </p>
        )}
      </div>
    </div>
  );
}

export default function AgentActivityPage() {
  const activities = useAgentActivity(50);

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">AI Agent Activity</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time pipeline steps as AI agents create and resolve markets
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_280px] gap-6">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Bot className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-medium">Live Timeline</h2>
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            </div>

            {activities.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-8 h-8 mx-auto text-zinc-300 mb-3" />
                <p className="text-sm text-zinc-500">Waiting for agent activity...</p>
                <p className="text-xs text-zinc-400 mt-1">Events appear here in real-time via WebSocket</p>
              </div>
            ) : (
              <div className="space-y-0">
                {activities.map((item) => (
                  <ActivityTimelineItem key={item.id} item={item} />
                ))}
              </div>
            )}
          </Card>

          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="text-xs font-semibold text-zinc-700 mb-2">Pipeline Steps</h3>
              <div className="space-y-2">
                {Object.entries(STEP_CONFIG).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                      <span className="text-xs text-zinc-600">{cfg.label}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-xs font-semibold text-zinc-700 mb-2">Stats</h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Events received</span>
                  <span className="font-mono font-medium">{activities.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Markets created</span>
                  <span className="font-mono font-medium">
                    {activities.filter((a) => a.step === "creating_market" || a.step === "complete").length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Resolutions</span>
                  <span className="font-mono font-medium">
                    {activities.filter((a) => a.step === "resolving").length}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
