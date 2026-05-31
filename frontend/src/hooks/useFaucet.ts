"use client";

import { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { SANTIORA_FAUCET_ABI } from "@/lib/abi/SantioraFaucet";
import { ERC20_ABI } from "@/lib/abi/ERC20";

const FAUCET_ADDRESS = "0xe52006902231785540d6f44884Ea68F97721aEe1" as const;
const SUSD_ADDRESS = "0xB553c0003C3F0419abD358A2edD16191fC86ef90" as const;
const COOLDOWN_SECONDS = 86400;
const CLAIM_GAS_LIMIT = 3_000_000n;

type FaucetState = "idle" | "claiming" | "confirmed" | "error";

export function useFaucet() {
  const { address, isConnected } = useAccount();
  const [state, setState] = useState<FaucetState>("idle");
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Read canClaim(address)
  const { data: canClaimResult, refetch: refetchCanClaim } = useReadContract({
    address: FAUCET_ADDRESS,
    abi: SANTIORA_FAUCET_ABI,
    functionName: "canClaim",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Read lastClaim(address)
  const { data: lastClaimTimestamp, refetch: refetchLastClaim } = useReadContract({
    address: FAUCET_ADDRESS,
    abi: SANTIORA_FAUCET_ABI,
    functionName: "lastClaim",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Read user SUSD balance
  const { data: susdBalanceRaw, refetch: refetchSusd } = useReadContract({
    address: SUSD_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Read user STT (native) balance
  const { data: sttBalanceData, refetch: refetchStt } = useBalance({
    address,
    query: { enabled: !!address },
  });

  // Read faucet STT balance (to show if faucet has funds)
  const { data: faucetBalanceData } = useBalance({
    address: FAUCET_ADDRESS,
  });

  // Write: claim()
  const {
    writeContract,
    data: txHash,
    isPending: isWritePending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  // Wait for TX confirmation
  const { isSuccess: isConfirmed, isLoading: isConfirming } =
    useWaitForTransactionReceipt({ hash: txHash });

  // Calculate time remaining from lastClaim
  useEffect(() => {
    if (lastClaimTimestamp === undefined || lastClaimTimestamp === 0n) {
      setTimeRemaining(0);
      return;
    }

    const lastClaimSec = Number(lastClaimTimestamp);
    const nextClaimAt = lastClaimSec + COOLDOWN_SECONDS;

    function updateTimer() {
      const nowSec = Math.floor(Date.now() / 1000);
      const remaining = nextClaimAt - nowSec;
      setTimeRemaining(remaining > 0 ? remaining : 0);
    }

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lastClaimTimestamp]);

  // Track state transitions
  useEffect(() => {
    if (isConfirmed) {
      setState("confirmed");
      refetchCanClaim();
      refetchLastClaim();
      refetchSusd();
      refetchStt();
    } else if (writeError) {
      setState("error");
    } else if (isWritePending || isConfirming) {
      setState("claiming");
    }
  }, [
    isConfirmed,
    writeError,
    isWritePending,
    isConfirming,
    refetchCanClaim,
    refetchLastClaim,
    refetchSusd,
    refetchStt,
  ]);

  const claim = useCallback(() => {
    setState("claiming");
    resetWrite();
    writeContract({
      address: FAUCET_ADDRESS,
      abi: SANTIORA_FAUCET_ABI,
      functionName: "claim",
      gas: CLAIM_GAS_LIMIT,
    });
  }, [writeContract, resetWrite]);

  const resetState = useCallback(() => {
    setState("idle");
    resetWrite();
  }, [resetWrite]);

  // Format balances
  const susdBalance = susdBalanceRaw
    ? Number(susdBalanceRaw) / 1e18
    : 0;

  const sttBalance = sttBalanceData
    ? Number(sttBalanceData.value) / 1e18
    : 0;

  const faucetSttBalance = faucetBalanceData
    ? Number(faucetBalanceData.value) / 1e18
    : 0;

  const isFaucetEmpty = faucetSttBalance < 0.1;

  return {
    isConnected,
    canClaim: canClaimResult ?? false,
    timeRemaining,
    susdBalance,
    sttBalance,
    faucetSttBalance,
    isFaucetEmpty,
    claim,
    state,
    txHash,
    error: writeError,
    resetState,
  };
}
