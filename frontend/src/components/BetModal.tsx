"use client";

import { useState } from "react";
import { usePlaceBet } from "@/hooks/useBetting";

interface BetModalProps {
  marketAddress: string;
  question: string;
  yesOdds: number;
  onClose: () => void;
}

export function BetModal({ marketAddress, question, yesOdds, onClose }: BetModalProps) {
  const [isYes, setIsYes] = useState(true);
  const [amount, setAmount] = useState("");
  const { placeBet, isPending, isConfirming, isSuccess, error } = usePlaceBet(marketAddress);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
    placeBet(isYes, amount);
  }

  if (isSuccess) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="card max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
          <div className="text-center space-y-2">
            <div className="text-3xl">✓</div>
            <h3 className="text-lg font-semibold text-[var(--accent-green)]">Bet Placed!</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              {amount} STT on {isYes ? "YES" : "NO"}
            </p>
          </div>
          <button onClick={onClose} className="w-full py-2 rounded-lg bg-[var(--bg-secondary)] text-sm">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="card max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-sm leading-tight">{question}</h3>

        <div className="flex gap-2">
          <button
            onClick={() => setIsYes(true)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              isYes ? "btn-yes" : "bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
            }`}
          >
            YES {yesOdds}%
          </button>
          <button
            onClick={() => setIsYes(false)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              !isYes ? "btn-no" : "bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
            }`}
          >
            NO {100 - yesOdds}%
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-[var(--text-secondary)] block mb-1">Amount (STT)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent-blue)]"
            />
          </div>

          {amount && parseFloat(amount) > 0 && (
            <div className="text-xs text-[var(--text-secondary)] space-y-1">
              <div className="flex justify-between">
                <span>Potential payout</span>
                <span className="text-[var(--text-primary)]">
                  {(parseFloat(amount) / ((isYes ? yesOdds : 100 - yesOdds) / 100)).toFixed(2)} STT
                </span>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-[var(--accent-red)]">
              {error.message?.includes("User rejected") ? "Transaction rejected" : "Transaction failed"}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending || isConfirming || !amount}
            className={`w-full py-3 rounded-lg text-sm font-semibold transition-colors ${
              isYes ? "btn-yes" : "btn-no"
            } disabled:opacity-50`}
          >
            {isPending ? "Confirm in wallet..." : isConfirming ? "Confirming..." : `Place ${isYes ? "YES" : "NO"} Bet`}
          </button>
        </form>
      </div>
    </div>
  );
}
