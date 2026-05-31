"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageTransition } from "@/components/shared/PageTransition";
import { MarketCard } from "@/components/market/MarketCard";
import { MarketCardSkeleton } from "@/components/shared/Skeletons";
import { useOnchainMarkets } from "@/hooks/useOnchainMarkets";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LayoutGrid, List, Search } from "lucide-react";

const STATUS_FILTERS = ["All", "Active", "Resolved", "Expired"] as const;

export default function MarketsPage() {
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const { markets, isLoading, error } = useOnchainMarkets();

  const filteredMarkets = useMemo(() => {
    let result = markets;

    if (activeFilter !== "All") {
      result = result.filter(
        (m) => m.status === activeFilter.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((m) =>
        m.question.toLowerCase().includes(query) ||
        m.category.toLowerCase().includes(query)
      );
    }

    return result;
  }, [markets, activeFilter, searchQuery]);

  const stats = useMemo(() => {
    const active = markets.filter(m => m.status === "active").length;
    const resolved = markets.filter(m => m.status === "resolved").length;
    const susd = markets.filter(m => m.isSusd).length;
    return { active, resolved, susd, total: markets.length };
  }, [markets]);

  return (
    <PageTransition>
      <PageHeader
        title="Prediction Markets"
        description="AI-created markets on Somnia — all data read directly from chain"
        action={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-muted-foreground">Live</span>
            </div>
            <div className="flex items-center gap-1 border rounded-md p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={cn("p-1.5 rounded", viewMode === "grid" && "bg-muted")}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn("p-1.5 rounded", viewMode === "list" && "bg-muted")}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        }
      />

      {/* Stats */}
      {!isLoading && (
        <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
          <span><strong className="text-foreground">{stats.total}</strong> markets</span>
          <span><strong className="text-green-600">{stats.active}</strong> active</span>
          <span><strong className="text-blue-600">{stats.resolved}</strong> resolved</span>
          <span><strong className="text-purple-600">{stats.susd}</strong> bettable (SUSD)</span>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search markets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>

      {/* Status Filters */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((filter) => (
          <Button
            key={filter}
            variant={activeFilter === filter ? "default" : "ghost"}
            size="sm"
            className="text-xs shrink-0"
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <MarketCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-sm text-destructive">{error}</p>
          <p className="text-xs text-muted-foreground">
            Failed to read on-chain data. Check RPC connection.
          </p>
        </div>
      ) : filteredMarkets.length > 0 ? (
        <div className={cn(
          viewMode === "grid"
            ? "grid md:grid-cols-2 lg:grid-cols-3 gap-3"
            : "space-y-2"
        )}>
          {filteredMarkets.map((market) => (
            <MarketCard key={market.address} market={market} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 space-y-3">
          <Search className="w-10 h-10 mx-auto text-muted-foreground" />
          <h3 className="text-sm font-medium">No markets found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery.trim()
              ? `No markets match "${searchQuery}".`
              : "No markets in this filter."}
          </p>
        </div>
      )}
    </PageTransition>
  );
}
