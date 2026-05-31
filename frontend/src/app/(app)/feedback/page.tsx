"use client";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";

const resolutions = [
  { market: "BTC > $100k in 2025?", outcome: "YES", confidence: 95 },
  { market: "ETH > $5k by May?", outcome: "YES", confidence: 92 },
  { market: "Fed rate cut Q1?", outcome: "NO", confidence: 88 },
];

export default function FeedbackPage() {
  return (
    <PageTransition>
      <PageHeader title="Feedback" description="Rate AI resolution quality" />
      <div className="space-y-3">
        {resolutions.map((r, i) => (
          <Card key={i} className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{r.market}</p>
              <p className="text-xs text-muted-foreground">Resolved: {r.outcome} ({r.confidence}% confidence)</p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm"><ThumbsUp className="w-4 h-4 text-success" /></Button>
              <Button variant="ghost" size="sm"><ThumbsDown className="w-4 h-4 text-destructive" /></Button>
            </div>
          </Card>
        ))}
      </div>
    </PageTransition>
  );
}
