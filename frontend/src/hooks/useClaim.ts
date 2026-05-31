"use client";

import { useWriteContract, useWaitForTransactionReceipt, useAccount, useReadContract } from "wagmi";

const MARKET_ABI = [
  {
    name: "redeem",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "outcome",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    name: "status",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    name: "yesToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    name: "noToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

const SHARE_TOKEN_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export function useClaim(marketAddress: string) {
  const { address: userAddress } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const { data: marketStatus } = useReadContract({
    address: marketAddress as `0x${string}`,
    abi: MARKET_ABI,
    functionName: "status",
  });

  const isResolved = marketStatus !== undefined && Number(marketStatus) >= 3;

  const { data: marketOutcome } = useReadContract({
    address: marketAddress as `0x${string}`,
    abi: MARKET_ABI,
    functionName: "outcome",
    query: { enabled: isResolved },
  });

  const { data: yesTokenAddr } = useReadContract({
    address: marketAddress as `0x${string}`,
    abi: MARKET_ABI,
    functionName: "yesToken",
    query: { enabled: isResolved },
  });

  const { data: noTokenAddr } = useReadContract({
    address: marketAddress as `0x${string}`,
    abi: MARKET_ABI,
    functionName: "noToken",
    query: { enabled: isResolved },
  });

  const winningToken = marketOutcome === true ? yesTokenAddr : noTokenAddr;

  const { data: winningBalance } = useReadContract({
    address: winningToken as `0x${string}`,
    abi: SHARE_TOKEN_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!winningToken && !!userAddress && isResolved },
  });

  const canClaim = winningBalance !== undefined && winningBalance > 0n;

  function claim() {
    writeContract({
      address: marketAddress as `0x${string}`,
      abi: MARKET_ABI,
      functionName: "redeem",
    });
  }

  return {
    claim,
    canClaim,
    isResolved,
    winningBalance,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}
