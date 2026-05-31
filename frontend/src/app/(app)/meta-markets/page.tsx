"use client";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers } from "lucide-react";

export default function MetaMarketsPage() {
  return (
    <PageTransition>
      <PageHeader title="Meta-Markets" description="Bet on AI accuracy — markets about markets" />
      <Card className="p-4 mb-6 bg-muted/50">
        <p className="text-xs text-muted-foreground">Meta-markets let you trade on whether AI will correctly resolve other markets. AI accuracy becomes tradeable. These are created automatically when regular markets exist.</p>
      </Card>
      <div className="text-center py-16">
        <Layers className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="text-sm font-medium">No meta-markets yet</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">Meta-markets will be created automatically once regular markets are active and approaching resolution.</p>
      </div>
    </PageTransition>
  );
}
