"use client";

import { useState, useCallback } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { SUSD_ABI, SUSD_ADDRESS } from "@/lib/abi/SUSD";
import { CONTRACTS } from "@/lib/config";
import type { Address } from "viem";

export type BetState = "idle" | "approving" | "betting" | "confirmed" | "error";

const V5_POOL_ABI = [
  {
    name: "bet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "isYes", type: "bool" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "claim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "getOdds",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [
      { name: "yesOdds", type: "uint256" },
      { name: "noOdds", type: "uint256" },
    ],
  },
  {
    name: "getPosition",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [
      { name: "yes", type: "uint256" },
      { name: "no", type: "uint256" },
    ],
  },
  {
    name: "claimed",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "pools",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [
      { name: "yesTotal", type: "uint256" },
      { name: "noTotal", type: "uint256" },
      { name: "exists", type: "bool" },
    ],
  },
] as const;

export { V5_POOL_ABI };

const POOL_ADDR = CONTRACTS.V5_BETTING_POOL as Address;

export function useV5BettingPool(marketId: number) {
  const { address: userAddress } = useAccount();

  const { data: odds, refetch: refetchOdds } = useReadContract({
    address: POOL_ADDR,
    abi: V5_POOL_ABI,
    functionName: "getOdds",
    args: [BigInt(marketId >= 0 ? marketId : 0)],
    query: { enabled: marketId >= 0, refetchInterval: 15000 },
  });

  const { data: pool, refetch: refetchPool } = useReadContract({
    address: POOL_ADDR,
    abi: V5_POOL_ABI,
    functionName: "pools",
    args: [BigInt(marketId >= 0 ? marketId : 0)],
    query: { enabled: marketId >= 0, refetchInterval: 15000 },
  });

  const { data: position, refetch: refetchPosition } = useReadContract({
    address: POOL_ADDR,
    abi: V5_POOL_ABI,
    functionName: "getPosition",
    args: [BigInt(marketId >= 0 ? marketId : 0), userAddress!],
    query: { enabled: marketId >= 0 && !!userAddress },
  });

  const { data: alreadyClaimed, refetch: refetchClaimed } = useReadContract({
    address: POOL_ADDR,
    abi: V5_POOL_ABI,
    functionName: "claimed",
    args: [BigInt(marketId >= 0 ? marketId : 0), userAddress!],
    query: { enabled: marketId >= 0 && !!userAddress },
  });

  const oddsArr = odds as readonly [bigint, bigint] | undefined;
  const poolArr = pool as readonly [bigint, bigint, boolean] | undefined;
  const posArr  = position as readonly [bigint, bigint] | undefined;

  const refetchAll = () => {
    refetchOdds();
    refetchPool();
    refetchPosition();
    refetchClaimed();
  };

  return {
    yesOdds: oddsArr ? Number(oddsArr[0]) : 50,
    noOdds:  oddsArr ? Number(oddsArr[1]) : 50,
    yesTotal: poolArr ? poolArr[0] : 0n,
    noTotal:  poolArr ? poolArr[1] : 0n,
    userYes:  posArr  ? posArr[0]  : 0n,
    userNo:   posArr  ? posArr[1]  : 0n,
    alreadyClaimed: alreadyClaimed as boolean ?? false,
    refetch: refetchAll,
  };
}

export function useV5PlaceBet(marketId: number, onSuccess?: () => void) {
  const { address: userAddress } = useAccount();
  const [state, setState] = useState<BetState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [betTxHash, setBetTxHash] = useState<`0x${string}` | undefined>(undefined);

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: SUSD_ADDRESS,
    abi: SUSD_ABI,
    functionName: "allowance",
    args: [userAddress!, POOL_ADDR],
    query: { enabled: !!userAddress },
  });

  const { writeContractAsync } = useWriteContract();

  const { isSuccess: isBetConfirmed } = useWaitForTransactionReceipt({ hash: betTxHash });

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

      try {
        const currentAllowance = (allowance as bigint) ?? 0n;
        if (currentAllowance < params.amount) {
          setState("approving");
          await writeContractAsync({
            address: SUSD_ADDRESS,
            abi: SUSD_ABI,
            functionName: "approve",
            args: [POOL_ADDR, params.amount],
            gas: 5_000_000n,
          });
          await refetchAllowance();
        }

        setState("betting");
        const hash = await writeContractAsync({
          address: POOL_ADDR,
          abi: V5_POOL_ABI,
          functionName: "bet",
          args: [BigInt(marketId), params.isYes, params.amount],
          gas: 15_000_000n,
        });
        setBetTxHash(hash);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Transaction failed";
        if (message.includes("User rejected") || message.includes("user rejected")) {
          setError("Transaction rejected");
        } else {
          setError(message.length > 100 ? message.slice(0, 100) + "..." : message);
        }
        setState("error");
      }
    },
    [userAddress, allowance, marketId, writeContractAsync, refetchAllowance]
  );

  const claimWinnings = useCallback(async () => {
    if (!userAddress) return;
    setError(null);
    try {
      setState("betting");
      const hash = await writeContractAsync({
        address: POOL_ADDR,
        abi: V5_POOL_ABI,
        functionName: "claim",
        args: [BigInt(marketId)],
        gas: 10_000_000n,
      });
      setBetTxHash(hash);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Claim failed";
      setError(message.length > 100 ? message.slice(0, 100) + "..." : message);
      setState("error");
    }
  }, [userAddress, marketId, writeContractAsync]);

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
    setBetTxHash(undefined);
  }, []);

  return { placeBet, claimWinnings, state, txHash: betTxHash, error, reset };
}
