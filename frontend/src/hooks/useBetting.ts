import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { PREDICTION_MARKET_ABI } from "@/lib/abi/PredictionMarket";

export function usePlaceBet(marketAddress: string) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function placeBet(isYes: boolean, amountSTT: string) {
    const value = parseEther(amountSTT);
    writeContract({
      address: marketAddress as `0x${string}`,
      abi: PREDICTION_MARKET_ABI,
      functionName: "bet",
      args: [isYes, value],
      value,
    });
  }

  return { placeBet, isPending, isConfirming, isSuccess, error, hash };
}

export function useRedeem(marketAddress: string) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function redeem() {
    writeContract({
      address: marketAddress as `0x${string}`,
      abi: PREDICTION_MARKET_ABI,
      functionName: "redeem",
    });
  }

  return { redeem, isPending, isConfirming, isSuccess, error, hash };
}
