"use client";
import { useState } from "react";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Zap } from "lucide-react";

const examples = ["Will ETH reach $10k by 2027?", "Will AI replace 50% of jobs by 2030?", "Will Somnia mainnet launch Q3 2026?"];

export default function OraclePlaygroundPage() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<{probability: number; confidence: number} | null>(null);
  const [loading, setLoading] = useState(false);

  const handleQuery = () => {
    if (!question) return;
    setLoading(true);
    setTimeout(() => {
      setResult({ probability: Math.floor(Math.random() * 80) + 10, confidence: Math.floor(Math.random() * 30) + 65 });
      setLoading(false);
    }, 1500);
  };

  return (
    <PageTransition>
      <PageHeader title="Oracle Playground" description="Ask any question — get AI probability" />
      <Card className="p-6 max-w-xl mx-auto">
        <div className="space-y-4">
          <Input placeholder="Will ETH reach $10,000 by end of 2027?" value={question} onChange={e => setQuestion(e.target.value)} className="text-sm" />
          <div className="flex flex-wrap gap-1.5">
            {examples.map(ex => (
              <button key={ex} onClick={() => setQuestion(ex)} className="text-[10px] px-2 py-1 rounded-full border hover:bg-muted transition-colors">{ex}</button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Fee: 0.1 STT per query</span>
            <Button onClick={handleQuery} disabled={!question || loading} size="sm"><Zap className="w-3.5 h-3.5 mr-1.5" />{loading ? "Analyzing..." : "Query Oracle"}</Button>
          </div>
        </div>
        {result && (
          <div className="mt-6 p-4 bg-muted rounded-lg text-center space-y-3">
            <p className="text-4xl font-mono font-bold">{result.probability}%</p>
            <p className="text-xs text-muted-foreground">Probability</p>
            <div className="max-w-xs mx-auto">
              <div className="flex justify-between text-xs mb-1"><span>Confidence</span><span className="font-mono">{result.confidence}%</span></div>
              <Progress value={result.confidence} />
            </div>
          </div>
        )}
      </Card>
    </PageTransition>
  );
}
