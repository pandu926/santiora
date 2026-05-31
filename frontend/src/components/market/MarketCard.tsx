"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface MarketData {
  address: string;
  question: string;
  category: string;
  yesOdds: number;
  volume: string;
  deadline: string;
  status: "active" | "expired" | "resolved" | "failed";
  isSusd?: boolean;
  outcome?: string;
  aiConfidence?: number;
}

const STATUS_CONFIG = {
  active: { label: "Active", color: "bg-green-500/10 text-green-600 border-green-500/20" },
  expired: { label: "Expired", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  resolved: { label: "Resolved", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  failed: { label: "Failed", color: "bg-red-500/10 text-red-600 border-red-500/20" },
};

export function MarketCard({ market }: { market: MarketData }) {
  const statusCfg = STATUS_CONFIG[market.status];
  const isResolved = market.status === "resolved";
  const isActive = market.status === "active";

  return (
    <Link href={`/markets/${market.address}`}>
      <motion.div
        whileHover={{ y: -2, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
        transition={{ duration: 0.15 }}
        className="border rounded-lg p-4 hover:border-primary/30 transition-all cursor-pointer h-full"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {market.category}
              </Badge>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusCfg.color}`}>
                {statusCfg.label}
              </Badge>
              {market.isSusd && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-500/10 text-purple-600 border-purple-500/20">
                  SUSD
                </Badge>
              )}
            </div>
            <h3 className="text-sm font-medium leading-snug line-clamp-2">
              {market.question}
            </h3>
          </div>
          <div className="text-right shrink-0">
            {isResolved ? (
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="font-mono text-lg font-bold text-green-600">{market.outcome}</span>
                </div>
                {market.aiConfidence ? (
                  <p className="text-[10px] text-muted-foreground">{market.aiConfidence}% conf</p>
                ) : null}
              </div>
            ) : (
              <>
                <p className="font-mono text-lg font-bold text-primary">{market.yesOdds}%</p>
                <p className="text-[10px] text-muted-foreground">YES</p>
              </>
            )}
          </div>
        </div>

        {!isResolved && (
          <div className="mt-3">
            <div className="flex h-1.5 rounded-full overflow-hidden bg-destructive/20">
              <div
                className="bg-success rounded-full transition-all duration-300"
                style={{ width: `${market.yesOdds}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {market.volume}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {market.deadline}
          </span>
        </div>
      </motion.div>
    </Link>
  );
}
