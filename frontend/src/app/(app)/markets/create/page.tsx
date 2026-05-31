"use client";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Loader2, Circle } from "lucide-react";

const steps = [
  { label: "Scrape News", status: "complete", detail: "CoinDesk, Reuters scanned" },
  { label: "Generate Question", status: "complete", detail: "Will BTC hit $200k by 2027?" },
  { label: "Set Initial Odds", status: "active", detail: "Analyzing probability..." },
  { label: "Create Market", status: "pending", detail: "" },
  { label: "Seed Liquidity", status: "pending", detail: "" },
];

export default function MarketCreatePage() {
  return (
    <PageTransition>
      <PageHeader title="AI Market Creation" description="Watch AI create a market in real-time" />
      <Card className="p-6 max-w-lg mx-auto">
        <div className="space-y-4">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              {step.status === "complete" ? <CheckCircle className="w-5 h-5 text-success shrink-0" /> : step.status === "active" ? <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" /> : <Circle className="w-5 h-5 text-muted-foreground shrink-0" />}
              <div className="flex-1">
                <p className="text-sm font-medium">{step.label}</p>
                {step.detail && <p className="text-xs text-muted-foreground">{step.detail}</p>}
              </div>
              <Badge variant={step.status === "complete" ? "default" : step.status === "active" ? "secondary" : "outline"} className="text-[10px]">{step.status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </PageTransition>
  );
}
