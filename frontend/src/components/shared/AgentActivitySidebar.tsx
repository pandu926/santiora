"use client";

import { useAgentActivity, type ActivityItem } from "@/hooks/useAgentActivity";
import { Bot, Globe, Brain, BarChart3, CheckCircle2, Loader2 } from "lucide-react";

const STEP_CONFIG: Record<string, { icon: typeof Bot; color: string; label: string }> = {
  scraping: { icon: Globe, color: "text-blue-500", label: "Scraping" },
  generating_question: { icon: Brain, color: "text-purple-500", label: "Generating" },
  setting_odds: { icon: BarChart3, color: "text-amber-500", label: "Setting Odds" },
  creating_market: { icon: CheckCircle2, color: "text-green-500", label: "Creating" },
  resolving: { icon: Brain, color: "text-indigo-500", label: "Resolving" },
  complete: { icon: CheckCircle2, color: "text-green-600", label: "Complete" },
};

function ActivityRow({ item }: { item: ActivityItem }) {
  const config = STEP_CONFIG[item.step] || { icon: Bot, color: "text-zinc-500", label: item.step };
  const Icon = config.icon;
  const timeAgo = formatTimeAgo(item.timestamp);

  return (
    <div className="flex items-start gap-2 py-2 border-b border-zinc-100 last:border-0">
      <div className={`mt-0.5 ${config.color}`}>
        {item.step === "complete" ? <Icon className="w-3.5 h-3.5" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-zinc-800 truncate">{item.detail}</p>
        <p className="text-[10px] text-zinc-400">{config.label} · {timeAgo}</p>
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function AgentActivitySidebar() {
  const activities = useAgentActivity(5);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-zinc-800">AI Activity</span>
        </div>
        <a href="/ai/activity" className="text-[10px] text-blue-500 hover:underline">
          View all
        </a>
      </div>
      {activities.length === 0 ? (
        <p className="text-xs text-zinc-400 py-2">Waiting for agent activity...</p>
      ) : (
        <div className="space-y-0">
          {activities.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
