interface StatsBarProps {
  totalMarkets: number;
  activeMarkets: number;
  totalVolume: string;
  aiActions: number;
}

export function StatsBar({ totalMarkets, activeMarkets, totalVolume, aiActions }: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="card text-center py-4">
        <div className="text-2xl font-bold">{totalMarkets}</div>
        <div className="text-xs text-[var(--text-secondary)]">Total Markets</div>
      </div>
      <div className="card text-center py-4">
        <div className="text-2xl font-bold text-[var(--accent-green)]">{activeMarkets}</div>
        <div className="text-xs text-[var(--text-secondary)]">Active</div>
      </div>
      <div className="card text-center py-4">
        <div className="text-2xl font-bold">{totalVolume}</div>
        <div className="text-xs text-[var(--text-secondary)]">Volume (STT)</div>
      </div>
      <div className="card text-center py-4">
        <div className="text-2xl font-bold text-[var(--accent-purple)]">{aiActions}</div>
        <div className="text-xs text-[var(--text-secondary)]">AI Actions</div>
      </div>
    </div>
  );
}
