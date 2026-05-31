"use client";
import { useEffect, useState } from "react";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { MarketCard } from "@/components/market/MarketCard";
import { MarketCardSkeleton } from "@/components/shared/Skeletons";
import { fetchMarkets, MarketResponse } from "@/lib/api";
import { AnimatedList, AnimatedItem } from "@/components/shared/Animations";
import { TrendingUp } from "lucide-react";

export default function TrendingPage() {
  const [markets, setMarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMarkets({ limit: 20 })
      .then(data => {
        const sorted = data.sort((a, b) => parseFloat(b.total_collateral) - parseFloat(a.total_collateral));
        setMarkets(sorted.map(m => ({
          address: m.address,
          question: m.question,
          category: m.category,
          yesOdds: Math.round((parseFloat(m.yes_supply) / Math.max(parseFloat(m.yes_supply) + parseFloat(m.no_supply), 1)) * 100) || 50,
          volume: (parseFloat(m.total_collateral) / 1e18).toFixed(0),
          deadline: new Date(m.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          status: m.status >= 3 ? "resolved" as const : "active" as const,
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageTransition>
      <PageHeader title="Trending" description="Markets with highest volume" />
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({length:6}).map((_,i) => <MarketCardSkeleton key={i} />)}</div>
      ) : markets.length > 0 ? (
        <AnimatedList className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {markets.map(m => <AnimatedItem key={m.address}><MarketCard market={m} /></AnimatedItem>)}
        </AnimatedList>
      ) : (
        <div className="text-center py-16"><TrendingUp className="w-10 h-10 mx-auto text-muted-foreground mb-3" /><p className="text-sm text-muted-foreground">No trending markets yet. AI agents will create markets soon.</p></div>
      )}
    </PageTransition>
  );
}
