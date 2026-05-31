interface Activity {
  time: string;
  action: string;
  detail: string;
  agent: string;
}

interface AIActivityFeedProps {
  activities: Activity[];
}

const agentColors: Record<string, string> = {
  MarketCreator: "var(--accent-blue)",
  MarketResolver: "var(--accent-purple)",
  OddsEngine: "var(--accent-green)",
  LiquidityEngine: "orange",
};

export function AIActivityFeed({ activities }: AIActivityFeedProps) {
  return (
    <div className="card space-y-3 max-h-[600px] overflow-y-auto">
      {activities.map((activity, i) => (
        <div key={i} className="flex gap-3 pb-3 border-b border-[var(--border)] last:border-0">
          <div
            className="w-2 h-2 rounded-full mt-2 shrink-0"
            style={{ background: agentColors[activity.agent] || "gray" }}
          ></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">{activity.action}</span>
              <span className="text-[10px] text-[var(--text-secondary)] shrink-0">{activity.time}</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] truncate">{activity.detail}</p>
            <span className="text-[10px] text-[var(--text-secondary)] opacity-60">{activity.agent}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
