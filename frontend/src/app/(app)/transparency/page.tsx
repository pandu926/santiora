"use client";
import { useEffect, useState } from "react";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Shield } from "lucide-react";
import { fetchAIActivity } from "@/lib/api";

export default function TransparencyPage() {
  const [decisions, setDecisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAIActivity()
      .then(d => setDecisions(d.activities))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageTransition>
      <PageHeader title="Transparency" description="All AI decisions are onchain — verify everything" />
      <Card className="p-4 mb-6 flex items-center gap-3 bg-muted/50">
        <Shield className="w-5 h-5 text-primary shrink-0" />
        <p className="text-xs text-muted-foreground">Every AI action is recorded on Somnia blockchain. No hidden decisions, no manual overrides. All verifiable via explorer.</p>
      </Card>
      <Card className="divide-y">
        {loading ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading...</div>
        ) : decisions.length > 0 ? decisions.map((d, i) => (
          <div key={i} className="px-4 py-3 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{d.type || d.agent}</Badge>
                <span className="text-sm font-medium">{d.desc || d.action}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{new Date(d.time).toLocaleString()}</span>
                <a href="https://shannon-explorer.somnia.network" target="_blank" className="text-primary"><ExternalLink className="w-3 h-3" /></a>
              </div>
            </div>
          </div>
        )) : (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">No AI decisions recorded yet. Transparency log will populate as agents operate.</div>
        )}
      </Card>
    </PageTransition>
  );
}
