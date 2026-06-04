"use client";

import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOnchainActivity, OnchainActivity } from "@/hooks/useOnchainActivity";
import { Bot, Zap, Clock, CheckCircle2, XCircle, Radio, ArrowRight } from "lucide-react";

const TYPE_CONFIG: Record<OnchainActivity["type"], { icon: typeof Bot; color: string; label: string }> = {
  create: { icon: Zap, color: "bg-blue-500/10 text-blue-600 border-blue-500/20", label: "Create" },
  resolve: { icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", label: "Resolve" },
  schedule: { icon: Clock, color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20", label: "Schedule" },
  agent: { icon: Bot, color: "bg-purple-500/10 text-purple-600 border-purple-500/20", label: "Agent" },
  market: { icon: Radio, color: "bg-green-500/10 text-green-600 border-green-500/20", label: "Market" },
  skip: { icon: XCircle, color: "bg-gray-500/10 text-gray-500 border-gray-500/20", label: "Skip" },
  system: { icon: ArrowRight, color: "bg-orange-500/10 text-orange-600 border-orange-500/20", label: "System" },
};

function ActivityRow({ activity }: { activity: OnchainActivity }) {
  const config = TYPE_CONFIG[activity.type];
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
      <div className={`mt-0.5 p-1.5 rounded-md ${config.color}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 shrink-0 ${config.color}`}>
            {config.label}
          </Badge>
          <span className="text-sm font-medium truncate">{activity.title}</span>
        </div>
        <p className="text-xs text-muted-foreground">{activity.detail}</p>
      </div>
      <div className="text-right shrink-0">
        <span className="text-[10px] text-muted-foreground font-mono">#{activity.blockNumber.toLocaleString()}</span>
        {activity.txHash && (
          <a
            href={`https://shannon-explorer.somnia.network/tx/${activity.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[9px] text-primary hover:underline mt-0.5 font-mono"
          >
            {activity.txHash.slice(0, 10)}...
          </a>
        )}
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const { activities, loading } = useOnchainActivity(80);

  return (
    <PageTransition>
      <PageHeader
        title="On-Chain Activity"
        description="Real-time autonomous agent operations — every action is a verifiable transaction"
      />

      <Card className="p-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-muted-foreground">
            Live — polling every 15s
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>ReactiveV4 + SantioraV4</span>
          <span className="font-mono">{activities.length} events</span>
        </div>
      </Card>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
          <Badge key={key} variant="outline" className={`text-[9px] ${cfg.color}`}>
            {cfg.label}
          </Badge>
        ))}
      </div>

      <Card className="divide-y divide-border/50 overflow-hidden">
        {loading ? (
          <div className="px-4 py-16 text-center">
            <Bot className="w-8 h-8 mx-auto text-muted-foreground mb-3 animate-pulse" />
            <p className="text-sm text-muted-foreground">Loading on-chain events...</p>
          </div>
        ) : activities.length > 0 ? (
          activities.map((a) => <ActivityRow key={a.id} activity={a} />)
        ) : (
          <div className="px-4 py-16 text-center">
            <Radio className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No recent activity</p>
            <p className="text-xs text-muted-foreground mt-1">Waiting for next scheduled trigger</p>
          </div>
        )}
      </Card>
    </PageTransition>
  );
}
