"use client";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Activity, Zap } from "lucide-react";

const queries = [
  { question: "Will ETH reach $10k by 2027?", probability: 28, confidence: 82, date: "2h ago" },
  { question: "Will BTC dominance exceed 60%?", probability: 45, confidence: 76, date: "5h ago" },
  { question: "Will Somnia TVL exceed $1B?", probability: 62, confidence: 71, date: "8h ago" },
];

export default function OraclePage() {
  return (
    <PageTransition>
      <PageHeader title="Santiora Oracle" description="AI-powered probability predictions for any dApp" />
      <div className="grid md:grid-cols-3 gap-3 mb-8">
        <Card className="p-4 text-center"><p className="text-xs text-muted-foreground">Total Queries</p><p className="text-2xl font-mono font-bold mt-1">1,247</p></Card>
        <Card className="p-4 text-center"><p className="text-xs text-muted-foreground">Avg Confidence</p><p className="text-2xl font-mono font-bold mt-1">79%</p></Card>
        <Card className="p-4 text-center"><p className="text-xs text-muted-foreground">Fees Collected</p><p className="text-2xl font-mono font-bold mt-1">124.7 STT</p></Card>
      </div>
      <Card className="p-4 mb-6 flex items-center justify-between">
        <div><p className="text-sm font-medium">Try the Oracle</p><p className="text-xs text-muted-foreground">Ask any question, get AI probability</p></div>
        <Link href="/oracle/playground" className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"><Zap className="w-4 h-4 mr-1.5" />Playground</Link>
      </Card>
      <h2 className="text-sm font-semibold mb-3">Recent Queries</h2>
      <Card className="divide-y">
        {queries.map((q, i) => (
          <div key={i} className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm">{q.question}</span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-bold">{q.probability}%</span>
              <Badge variant="outline" className="text-[10px]">{q.confidence}% conf</Badge>
              <span className="text-[10px] text-muted-foreground">{q.date}</span>
            </div>
          </div>
        ))}
      </Card>
    </PageTransition>
  );
}
