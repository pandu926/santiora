"use client";

import { useClaim } from "@/hooks/useClaim";
import { formatEther } from "viem";

export function ClaimButton({ marketAddress }: { marketAddress: string }) {
  const {
    claim,
    canClaim,
    isResolved,
    winningBalance,
    isPending,
    isConfirming,
    isSuccess,
    error,
  } = useClaim(marketAddress);

  if (!isResolved) return null;
  if (!canClaim && !isSuccess) return null;

  if (isSuccess) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
        <p className="text-sm font-medium text-green-700">Winnings claimed successfully!</p>
      </div>
    );
  }

  const displayAmount = winningBalance ? formatEther(winningBalance) : "0";

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
      <div className="text-center">
        <p className="text-xs text-green-600 font-medium">You won!</p>
        <p className="text-lg font-bold text-green-800">{displayAmount} SUSD</p>
      </div>
      <button
        onClick={claim}
        disabled={isPending || isConfirming}
        className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending
          ? "Confirming..."
          : isConfirming
          ? "Claiming..."
          : "Claim Winnings"}
      </button>
      {error && (
        <p className="text-xs text-red-600 text-center">
          {error.message?.slice(0, 100) || "Transaction failed"}
        </p>
      )}
    </div>
  );
}
