"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { MarketCard } from "@/components/market/MarketCard";
import { MarketCardSkeleton } from "@/components/shared/Skeletons";
import { fetchMarkets } from "@/lib/api";
import { AnimatedList, AnimatedItem } from "@/components/shared/Animations";

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [markets, setMarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMarkets({ category: slug, limit: 50 })
      .then(data => {
        setMarkets(data.map(m => ({
          address: m.address, question: m.question, category: m.category,
          yesOdds: Math.round((parseFloat(m.yes_supply) / Math.max(parseFloat(m.yes_supply) + parseFloat(m.no_supply), 1)) * 100) || 50,
          volume: (parseFloat(m.total_collateral) / 1e18).toFixed(0),
          deadline: new Date(m.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          status: m.status >= 3 ? "resolved" as const : "active" as const,
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <PageTransition>
      <PageHeader title={slug.charAt(0).toUpperCase() + slug.slice(1)} description={`Markets in ${slug} category`} />
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({length:3}).map((_,i) => <MarketCardSkeleton key={i} />)}</div>
      ) : markets.length > 0 ? (
        <AnimatedList className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {markets.map(m => <AnimatedItem key={m.address}><MarketCard market={m} /></AnimatedItem>)}
        </AnimatedList>
      ) : (
        <div className="text-center py-16 text-sm text-muted-foreground">No markets in {slug} category yet.</div>
      )}
    </PageTransition>
  );
}
