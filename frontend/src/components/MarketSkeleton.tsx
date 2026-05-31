export function MarketSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex gap-2">
            <div className="h-4 w-16 bg-[var(--bg-secondary)] rounded-full"></div>
          </div>
          <div className="h-4 w-3/4 bg-[var(--bg-secondary)] rounded"></div>
          <div className="h-3 w-full bg-[var(--bg-secondary)] rounded"></div>
          <div className="flex justify-between">
            <div className="h-3 w-16 bg-[var(--bg-secondary)] rounded"></div>
            <div className="h-3 w-16 bg-[var(--bg-secondary)] rounded"></div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-12 bg-[var(--bg-secondary)] rounded"></div>
          <div className="h-4 w-16 bg-[var(--bg-secondary)] rounded"></div>
        </div>
      </div>
    </div>
  );
}

export function MarketSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <MarketSkeleton key={i} />
      ))}
    </div>
  );
}
