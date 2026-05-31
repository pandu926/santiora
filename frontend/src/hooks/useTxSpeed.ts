"use client";

import { useEffect, useRef, useState } from "react";
import { useWaitForTransactionReceipt } from "wagmi";
import { useSpeedStats } from "@/contexts/SpeedContext";

export function useTxSpeed(txHash: `0x${string}` | undefined) {
  const startTimeRef = useRef<number | null>(null);
  const [confirmationMs, setConfirmationMs] = useState<number | null>(null);
  const [gasUsed, setGasUsed] = useState<string | null>(null);
  const [gasCostWei, setGasCostWei] = useState<string | null>(null);
  const recordedRef = useRef(false);

  const { recordTx } = useSpeedStats();

  const { data: receipt, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  useEffect(() => {
    if (txHash && startTimeRef.current === null) {
      startTimeRef.current = Date.now();
      recordedRef.current = false;
    }
  }, [txHash]);

  useEffect(() => {
    if (isSuccess && receipt && startTimeRef.current !== null && !recordedRef.current) {
      const elapsed = Date.now() - startTimeRef.current;
      setConfirmationMs(elapsed);

      const used = receipt.gasUsed.toString();
      setGasUsed(used);

      const price = receipt.effectiveGasPrice ?? 0n;
      const cost = (receipt.gasUsed * price).toString();
      setGasCostWei(cost);

      recordTx({
        txHash: txHash!,
        confirmationMs: elapsed,
        gasUsed: used,
        gasCostWei: cost,
        timestamp: Date.now(),
      });

      recordedRef.current = true;
      startTimeRef.current = null;
    }
  }, [isSuccess, receipt, txHash, recordTx]);

  return {
    confirmationMs,
    gasUsed,
    gasCostWei,
    isConfirmed: isSuccess,
  };
}
