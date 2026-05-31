"use client";
import { useEffect, useState } from "react";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { fetchAIActivity } from "@/lib/api";

export default function ExplorerPage() {
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAIActivity()
      .then(d => setTxs(d.activities))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageTransition>
      <PageHeader title="Explorer" description="Recent protocol transactions on Somnia" />
      <Card className="divide-y">
        {loading ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading...</div>
        ) : txs.length > 0 ? txs.map((tx, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Badge variant="outline" className="text-[10px] shrink-0">{tx.type || tx.agent || "Agent"}</Badge>
            <span className="text-sm flex-1 truncate">{tx.desc || tx.action}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">{new Date(tx.time).toLocaleString()}</span>
            <a href="https://shannon-explorer.somnia.network" target="_blank" rel="noopener" className="text-primary"><ExternalLink className="w-3 h-3" /></a>
          </div>
        )) : (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">No transactions yet. Activity will appear as AI agents operate.</div>
        )}
      </Card>
    </PageTransition>
  );
}
