"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { PageTransition } from "@/components/shared/PageTransition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { Clock, TrendingUp, Bot, ExternalLink, Shield, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useMarketDetail } from "@/hooks/useMarketDetail";
import { usePlaceBet, type BetState } from "@/hooks/usePlaceBet";
import { useV5PlaceBet, useV5BettingPool } from "@/hooks/useV5PlaceBet";
import { SUSD_ABI, SUSD_ADDRESS } from "@/lib/abi/SUSD";
import { ResolutionPanel } from "./resolution-panel";
import { ClaimButton } from "./claim-button";
import { OddsChart } from "@/components/shared/OddsChart";

const STATUS_LABELS = ["Created", "Active", "Resolving", "Resolved", "Settled"] as const;
const QUICK_AMOUNTS = ["10", "50", "100", "500"] as const;

function formatCountdown(deadline: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = deadline - now;
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatSUSD(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return "0.00";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function stateLabel(state: BetState): string {
  switch (state) {
    case "approving": return "Approving SUSD...";
    case "betting": return "Placing bet...";
    case "confirmed": return "Confirmed!";
    case "error": return "Failed";
    default: return "";
  }
}

export default function MarketDetailPage() {
  const { address } = useParams<{ address: string }>();
  const { isConnected, address: userAddress } = useAccount();
  const [betSide, setBetSide] = useState<"yes" | "no">("yes");
  const [amount, setAmount] = useState("");
  const [countdown, setCountdown] = useState("");

  // Parse V5 market ID from contract:id URL format
  const isV5 = useMemo(() => {
    const decoded = decodeURIComponent(address || "");
    const colon = decoded.lastIndexOf(":");
    return colon > 0 && !isNaN(parseInt(decoded.slice(colon + 1), 10));
  }, [address]);

  const marketId = useMemo(() => {
    if (!isV5) return -1;
    const decoded = decodeURIComponent(address || "");
    return parseInt(decoded.slice(decoded.lastIndexOf(":") + 1), 10);
  }, [isV5, address]);

  const { market, isLoading, error, refetch } = useMarketDetail(address || "");

  // V5 pool data (live odds, pool totals, user position)
  const {
    yesOdds: poolYesOdds,
    noOdds: poolNoOdds,
    yesTotal,
    noTotal,
    userYes,
    userNo,
    alreadyClaimed,
    refetch: refetchPool,
  } = useV5BettingPool(marketId);

  const handleRefetch = () => { refetch(); refetchPool(); };

  // V5 bet/claim hooks (all hooks must be at top level)
  const {
    placeBet: v5PlaceBet,
    claimWinnings,
    state: v5BetState,
    txHash: v5TxHash,
    error: v5BetError,
    reset: resetV5Bet,
  } = useV5PlaceBet(marketId, handleRefetch);

  // Legacy SUSD hook
  const { placeBet: legacyPlaceBet, state: legacyBetState, txHash: legacyTxHash, error: legacyBetError, reset: resetLegacyBet } = usePlaceBet(
    address || "",
    handleRefetch
  );

  const placeBet   = isV5 ? v5PlaceBet   : legacyPlaceBet;
  const betState   = isV5 ? v5BetState   : legacyBetState;
  const txHash     = isV5 ? v5TxHash     : legacyTxHash;
  const betError   = isV5 ? v5BetError   : legacyBetError;
  const resetBet   = isV5 ? resetV5Bet   : resetLegacyBet;

  // Odds: for V5 use live pool odds, for legacy use market data
  const yesOdds = isV5 ? poolYesOdds : (market?.yesOdds ?? 50);
  const noOdds  = isV5 ? poolNoOdds  : (market?.noOdds  ?? 50);

  const poolVolume = isV5 ? Number(yesTotal + noTotal) / 1e18 : 0;
  const totalCollateral = isV5
    ? poolVolume.toFixed(2)
    : (market?.totalCollateral ?? "0");

  const hasPosition = isV5 && (userYes > 0n || userNo > 0n);
  const isResolved  = (market?.status ?? 0) >= 3;
  const canClaim    = isV5 && isResolved && hasPosition && !alreadyClaimed;

  // SUSD balance for connected user
  const { data: susdBalance } = useReadContract({
    address: SUSD_ADDRESS,
    abi: SUSD_ABI,
    functionName: "balanceOf",
    args: [userAddress!],
    query: { enabled: !!userAddress },
  });

  const formattedBalance = susdBalance ? formatUnits(susdBalance as bigint, 18) : "0";

  // Countdown timer
  useEffect(() => {
    if (!market?.deadline) return;
    setCountdown(formatCountdown(market.deadline));
    const interval = setInterval(() => {
      setCountdown(formatCountdown(market.deadline));
    }, 60_000);
    return () => clearInterval(interval);
  }, [market?.deadline]);

  // Potential payout calculation
  const potentialPayout = useMemo(() => {
    if (!amount || parseFloat(amount) <= 0) return "0.00";
    const odds = betSide === "yes" ? yesOdds : noOdds;
    if (odds <= 0) return "0.00";
    return (parseFloat(amount) / (odds / 100)).toFixed(2);
  }, [amount, betSide, yesOdds, noOdds]);

  const parsedAmount = useMemo(() => {
    try {
      return amount && parseFloat(amount) > 0 ? parseUnits(amount, 18) : 0n;
    } catch {
      return 0n;
    }
  }, [amount]);

  const isMarketActive = market?.status === 1 && market?.deadline > Math.floor(Date.now() / 1000);
  const isExpired = market?.status === 1 && market?.deadline <= Math.floor(Date.now() / 1000);
  const insufficientBalance = parsedAmount > 0n && susdBalance !== undefined && parsedAmount > (susdBalance as bigint);
  const canBet = isConnected && isMarketActive && parsedAmount > 0n && !insufficientBalance && betState === "idle";

  function handlePlaceBet() {
    if (!canBet) return;
    placeBet({ isYes: betSide === "yes", amount: parsedAmount });
  }

  // Loading state
  if (isLoading && !market) {
    return (
      <PageTransition>
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-6">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      </PageTransition>
    );
  }

  // Error state
  if (error && !market) {
    return (
      <PageTransition>
        <Card className="p-8 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-3 text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={refetch}>
            Retry
          </Button>
        </Card>
      </PageTransition>
    );
  }

  const isSusdMarket = market?.isSusdMarket ?? false;
  const showBetPanel = isV5 ? isMarketActive : isSusdMarket && isMarketActive;

  return (
    <PageTransition>
      <div className={`grid ${showBetPanel || canClaim ? "lg:grid-cols-[1fr_320px]" : ""} gap-6`}>
        {/* Main Content */}
        <div className="space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary" className="text-xs">{market?.category}</Badge>
              <Badge variant="outline" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {countdown}
              </Badge>
              <Badge
                variant={isMarketActive ? "default" : "secondary"}
                className={`text-xs ${isResolved ? "bg-blue-500/10 text-blue-600" : isExpired ? "bg-yellow-500/10 text-yellow-600" : ""}`}
              >
                {isResolved ? "Resolved" : isExpired ? "Expired" : STATUS_LABELS[market?.status ?? 0]}
              </Badge>
            </div>
            <h1 className="text-xl font-semibold leading-tight">{market?.question}</h1>
          </div>

          {/* Odds Display */}
          <Card className="p-5">
            {isResolved ? (
              <>
                <div className="text-center mb-3">
                  <p className="text-xs text-muted-foreground mb-2">Outcome</p>
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-6 h-6 text-success" />
                    <p className="font-mono text-4xl font-bold text-success">
                      {market?.outcome === true ? "YES" : "NO"}
                    </p>
                  </div>
                  {market?.resolutionConfidence ? (
                    <p className="text-sm text-muted-foreground mt-2">
                      Resolved with {market.resolutionConfidence}% AI confidence
                    </p>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className={`text-center p-3 rounded-md ${market?.outcome === true ? "bg-success/10 border border-success/30" : "bg-muted/50"}`}>
                    <p className="font-mono text-2xl font-bold">{market?.outcome === true ? "100%" : "0%"}</p>
                    <p className="text-xs text-muted-foreground">YES</p>
                  </div>
                  <div className={`text-center p-3 rounded-md ${market?.outcome === false ? "bg-success/10 border border-success/30" : "bg-muted/50"}`}>
                    <p className="font-mono text-2xl font-bold">{market?.outcome === false ? "100%" : "0%"}</p>
                    <p className="text-xs text-muted-foreground">NO</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-center">
                    <p className="font-mono text-3xl font-bold text-success">{yesOdds}%</p>
                    <p className="text-xs text-muted-foreground mt-1">YES</p>
                  </div>
                  <Separator orientation="vertical" className="h-12" />
                  <div className="text-center">
                    <p className="font-mono text-3xl font-bold text-destructive">{noOdds}%</p>
                    <p className="text-xs text-muted-foreground mt-1">NO</p>
                  </div>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden bg-destructive/20">
                  <div className="bg-success rounded-full" style={{ width: `${yesOdds}%` }} />
                </div>
                {isExpired && (
                  <p className="text-xs text-yellow-600 mt-2 text-center">Market expired — awaiting AI resolution</p>
                )}
              </>
            )}
          </Card>

          {/* Live Odds Chart */}
          <Card className="p-5">
            <OddsChart marketAddress={address || ""} yesOdds={yesOdds} />
          </Card>

          {/* Market Info */}
          <Card className="p-5">
            <h3 className="text-sm font-medium mb-3">Market Info</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Volume</p>
                <p className="font-mono font-medium">{formatSUSD(totalCollateral)} SUSD</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fee</p>
                <p className="font-mono font-medium">{market?.feePercent ? (market.feePercent / 100).toFixed(1) : "0"}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="font-medium">
                  {market?.createdAt ? new Date(market.createdAt).toLocaleDateString() : "--"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deadline</p>
                <p className="font-medium">
                  {market?.deadline ? new Date(market.deadline * 1000).toLocaleDateString() : "--"}
                </p>
              </div>
            </div>
          </Card>

          {/* Resolution Info */}
          <Card className="p-5">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Bot className="w-4 h-4" />
              AI Resolution
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <Shield className="w-3.5 h-3.5 text-primary" />
                <span>3 AI validators (deterministic consensus)</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                <span>Confidence threshold: 80%</span>
              </div>
              {market?.resolutionConfidence !== null && market?.resolutionConfidence !== undefined && (
                <div className="flex items-center gap-2 text-xs mt-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  <span>Resolved with {market.resolutionConfidence}% confidence</span>
                </div>
              )}
            </div>
          </Card>

          {/* Resolution Pipeline Status */}
          <ResolutionPanel marketAddress={address || ""} />

          {/* Claim Winnings */}
          <ClaimButton marketAddress={address || ""} />

          {/* Contract */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{address?.slice(0, 10)}...{address?.slice(-8)}</span>
            <a
              href={`https://shannon-explorer.somnia.network/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Bet Panel / Claim Panel (Sidebar) */}
        {(showBetPanel || canClaim) && (
        <div className="lg:sticky lg:top-20 h-fit space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-medium mb-4">Place Bet</h3>

            {/* Side Selection */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <Button
                variant={betSide === "yes" ? "default" : "outline"}
                className={betSide === "yes" ? "bg-success hover:bg-success/90 text-white" : ""}
                onClick={() => setBetSide("yes")}
              >
                YES {yesOdds}%
              </Button>
              <Button
                variant={betSide === "no" ? "default" : "outline"}
                className={betSide === "no" ? "bg-destructive hover:bg-destructive/90 text-white" : ""}
                onClick={() => setBetSide("no")}
              >
                NO {noOdds}%
              </Button>
            </div>

            {/* Balance */}
            {isConnected && (
              <div className="flex justify-between text-xs mb-2">
                <span className="text-muted-foreground">Balance</span>
                <span className="font-mono">{formatSUSD(formattedBalance)} SUSD</span>
              </div>
            )}

            {/* Amount */}
            <div className="space-y-2 mb-4">
              <label className="text-xs text-muted-foreground">Amount (SUSD)</label>
              <Input
                type="number"
                step="1"
                min="1"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="font-mono"
                disabled={betState !== "idle"}
              />
              <div className="flex gap-1.5">
                {QUICK_AMOUNTS.map(v => (
                  <Button
                    key={v}
                    variant="outline"
                    size="sm"
                    className="text-xs flex-1"
                    onClick={() => setAmount(v)}
                    disabled={betState !== "idle"}
                  >
                    {v}
                  </Button>
                ))}
              </div>
            </div>

            {/* Payout */}
            {amount && parseFloat(amount) > 0 && (
              <div className="bg-muted rounded-md p-3 mb-4 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Potential payout</span>
                  <span className="font-mono font-medium">{potentialPayout} SUSD</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Profit</span>
                  <span className="font-mono font-medium text-success">
                    +{(parseFloat(potentialPayout) - parseFloat(amount)).toFixed(2)} SUSD
                  </span>
                </div>
              </div>
            )}

            {/* Insufficient balance warning */}
            {insufficientBalance && (
              <p className="text-xs text-destructive mb-3">Insufficient SUSD balance</p>
            )}

            {/* Transaction state feedback */}
            {betState !== "idle" && (
              <div className="mb-3 p-2 rounded-md bg-muted text-xs space-y-1">
                <div className="flex items-center gap-2">
                  {betState === "confirmed" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  ) : betState === "error" ? (
                    <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                  ) : (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>{stateLabel(betState)}</span>
                </div>
                {txHash && (
                  <a
                    href={`https://shannon-explorer.somnia.network/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-mono block truncate"
                  >
                    {txHash.slice(0, 16)}...{txHash.slice(-8)}
                  </a>
                )}
                {betError && <p className="text-destructive">{betError}</p>}
                {(betState === "confirmed" || betState === "error") && (
                  <Button variant="ghost" size="sm" className="text-xs mt-1 h-6 px-2" onClick={resetBet}>
                    {betState === "confirmed" ? "Place another bet" : "Try again"}
                  </Button>
                )}
              </div>
            )}

            {/* Submit */}
            {isConnected ? (
              <Button
                className="w-full"
                size="lg"
                disabled={!canBet}
                onClick={handlePlaceBet}
              >
                {betState === "idle"
                  ? `Place ${betSide.toUpperCase()} Bet`
                  : stateLabel(betState)}
              </Button>
            ) : (
              <Button className="w-full" size="lg" variant="outline" disabled>
                Connect Wallet to Bet
              </Button>
            )}
          </Card>

          {/* V5 Pool Stats */}
          {isV5 && (
            <Card className="p-4">
              <h3 className="text-xs font-semibold mb-3">Pool Stats</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">YES Pool</span>
                  <span className="font-mono">{(Number(yesTotal) / 1e18).toFixed(2)} SUSD</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">NO Pool</span>
                  <span className="font-mono">{(Number(noTotal) / 1e18).toFixed(2)} SUSD</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Volume</span>
                  <span className="font-mono font-medium">{poolVolume.toFixed(2)} SUSD</span>
                </div>
                {hasPosition && (
                  <>
                    <Separator className="my-1" />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Your YES</span>
                      <span className="font-mono text-success">{(Number(userYes) / 1e18).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Your NO</span>
                      <span className="font-mono text-destructive">{(Number(userNo) / 1e18).toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}

          {/* V5 Claim Winnings */}
          {canClaim && (
            <Card className="p-4 border-success/30 bg-success/5">
              <h3 className="text-xs font-semibold text-success mb-2 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Winnings Available
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Market resolved — claim your SUSD winnings.
              </p>
              {v5BetState === "confirmed" ? (
                <p className="text-xs text-success text-center font-medium">Claimed successfully ✓</p>
              ) : (
                <Button
                  className="w-full"
                  size="sm"
                  disabled={v5BetState !== "idle"}
                  onClick={claimWinnings}
                >
                  {v5BetState === "betting" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                  {v5BetState === "betting" ? "Claiming..." : "Claim Winnings"}
                </Button>
              )}
              {v5BetError && <p className="text-xs text-destructive mt-2">{v5BetError}</p>}
            </Card>
          )}
        </div>
        )}
      </div>
    </PageTransition>
  );
}
