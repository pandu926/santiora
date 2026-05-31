"use client";

import { useState, useCallback } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { PREDICTION_MARKET_SUSD_ABI } from "@/lib/abi/PredictionMarketSUSD";
import { SUSD_ABI, SUSD_ADDRESS } from "@/lib/abi/SUSD";

export type BetState = "idle" | "approving" | "betting" | "confirmed" | "error";

interface UsePlaceBetReturn {
  placeBet: (params: { isYes: boolean; amount: bigint }) => void;
  state: BetState;
  txHash: `0x${string}` | undefined;
  error: string | null;
  reset: () => void;
}

export function usePlaceBet(marketAddress: string, onSuccess?: () => void): UsePlaceBetReturn {
  const { address: userAddress } = useAccount();
  const [state, setState] = useState<BetState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [betTxHash, setBetTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [startTime, setStartTime] = useState<number>(0);

  const marketAddr = marketAddress as `0x${string}`;

  // Read current allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: SUSD_ADDRESS,
    abi: SUSD_ABI,
    functionName: "allowance",
    args: [userAddress!, marketAddr],
    query: { enabled: !!userAddress },
  });

  const { writeContractAsync } = useWriteContract();

  const { isSuccess: isBetConfirmed } = useWaitForTransactionReceipt({
    hash: betTxHash,
  });

  // When bet TX confirms, update state
  if (isBetConfirmed && state === "betting") {
    setState("confirmed");
    onSuccess?.();
  }

  const placeBet = useCallback(
    async (params: { isYes: boolean; amount: bigint }) => {
      if (!userAddress) {
        setError("Wallet not connected");
        setState("error");
        return;
      }

      setError(null);
      setStartTime(Date.now());

      try {
        // Step 1: Check allowance and approve if needed (exact amount per threat model T-08-06)
        const currentAllowance = allowance ?? 0n;
        if (currentAllowance < params.amount) {
          setState("approving");
          await writeContractAsync({
            address: SUSD_ADDRESS,
            abi: SUSD_ABI,
            functionName: "approve",
            args: [marketAddr, params.amount],
            gas: 5_000_000n,
          });
          await refetchAllowance();
        }

        // Step 2: Place bet
        setState("betting");
        const hash = await writeContractAsync({
          address: marketAddr,
          abi: PREDICTION_MARKET_SUSD_ABI,
          functionName: "bet",
          args: [params.isYes, params.amount],
          gas: 10_000_000n,
        });
        setBetTxHash(hash);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Transaction failed";
        // Shorten common wallet rejection messages
        if (message.includes("User rejected") || message.includes("user rejected")) {
          setError("Transaction rejected by user");
        } else {
          setError(message.length > 100 ? message.slice(0, 100) + "..." : message);
        }
        setState("error");
      }
    },
    [userAddress, allowance, marketAddr, writeContractAsync, refetchAllowance]
  );

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
    setBetTxHash(undefined);
    setStartTime(0);
  }, []);

  return {
    placeBet,
    state,
    txHash: betTxHash,
    error,
    reset,
  };
}
