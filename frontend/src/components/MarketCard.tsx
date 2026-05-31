"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { BetModal } from "./BetModal";

interface MarketProps {
  market: {
    id: string;
    question: string;
    category: string;
    yesOdds: number;
    volume: string;
    deadline: string;
    status: "active" | "resolved";
    aiConfidence: number;
    outcome?: boolean;
  };
}

const categoryColors: Record<string, string> = {
  crypto: "bg-[var(--accent-blue)]",
  politics: "bg-[var(--accent-purple)]",
  tech: "bg-orange-500",
  sports: "bg-green-500",
};

export function MarketCard({ market }: MarketProps) {
  const [showBetModal, setShowBetModal] = useState(false);
  const { isConnected } = useAccount();

  function handleBetClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (isConnected) {
      setShowBetModal(true);
    }
  }

  return (
    <>
      <div className="card hover:border-[var(--accent-blue)] transition-colors cursor-pointer">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full text-white ${categoryColors[market.category] || "bg-gray-500"}`}>
                {market.category}
              </span>
              {market.status === "resolved" && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent-green)] text-black font-semibold">
                  RESOLVED
                </span>
              )}
            </div>
            <h3 className="font-medium text-sm leading-tight mb-3">{market.question}</h3>

            <div className="odds-bar mb-2">
              <div className="odds-bar-fill" style={{ width: `${market.yesOdds}%` }}></div>
            </div>

            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span className="text-[var(--accent-green)] font-medium">YES {market.yesOdds}%</span>
              <span className="text-[var(--accent-red)] font-medium">NO {100 - market.yesOdds}%</span>
            </div>
          </div>

          <div className="text-right text-xs space-y-1">
            <div className="text-[var(--text-secondary)]">Vol</div>
            <div className="font-medium">{market.volume} STT</div>
            <div className="text-[var(--text-secondary)] mt-2">Ends</div>
            <div className="font-medium">{market.deadline}</div>
          </div>
        </div>

        {market.status === "active" && (
          <div className="flex gap-2 mt-4">
            <button onClick={handleBetClick} className="btn-yes flex-1 text-sm py-2 rounded-lg font-semibold">
              Buy YES
            </button>
            <button onClick={handleBetClick} className="btn-no flex-1 text-sm py-2 rounded-lg font-semibold">
              Buy NO
            </button>
            {!isConnected && (
              <span className="text-[10px] text-[var(--text-secondary)] self-center">Connect wallet to bet</span>
            )}
          </div>
        )}

        {market.status === "resolved" && (
          <div className="mt-4 p-3 rounded-lg bg-[var(--bg-secondary)] text-xs">
            <span className="text-[var(--text-secondary)]">Outcome: </span>
            <span className={market.outcome ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}>
              {market.outcome ? "YES" : "NO"}
            </span>
            <span className="text-[var(--text-secondary)]"> • AI Confidence: {market.aiConfidence}%</span>
          </div>
        )}
      </div>

      {showBetModal && (
        <BetModal
          marketAddress={market.id}
          question={market.question}
          yesOdds={market.yesOdds}
          onClose={() => setShowBetModal(false)}
        />
      )}
    </>
  );
}
