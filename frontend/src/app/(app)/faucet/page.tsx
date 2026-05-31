"use client";

import { useEffect, useState } from "react";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Droplets, ExternalLink, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useFaucet } from "@/hooks/useFaucet";
import { useConnectModal } from "@rainbow-me/rainbowkit";

const EXPLORER_BASE = "https://shannon-explorer.somnia.network";
const FAUCET_ADDRESS = "0xe52006902231785540d6f44884Ea68F97721aEe1";

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatBalance(value: number, decimals: number = 2): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function FaucetPage() {
  const {
    isConnected,
    canClaim,
    timeRemaining,
    susdBalance,
    sttBalance,
    faucetSttBalance,
    isFaucetEmpty,
    claim,
    state,
    txHash,
    error,
    resetState,
  } = useFaucet();

  const { openConnectModal } = useConnectModal();

  // Auto-reset success state after 10s
  useEffect(() => {
    if (state === "confirmed") {
      const timeout = setTimeout(() => resetState(), 10000);
      return () => clearTimeout(timeout);
    }
  }, [state, resetState]);

  return (
    <PageTransition>
      <PageHeader
        title="Faucet"
        description="Claim STT for gas and SUSD for betting"
      />

      <div className="max-w-lg mx-auto space-y-4">
        {/* Balance Card */}
        {isConnected && (
          <Card className="p-5">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Your Balances
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">STT (gas)</p>
                <p className="text-lg font-mono font-semibold">
                  {formatBalance(sttBalance, 4)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">SUSD (betting)</p>
                <p className="text-lg font-mono font-semibold">
                  {formatBalance(susdBalance, 2)}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Main Claim Card */}
        <Card className="p-6 text-center space-y-5">
          <Droplets className="w-10 h-10 mx-auto text-primary" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Santiora Faucet</h2>
            <p className="text-sm text-muted-foreground">
              Claim 0.1 STT + 1,000 SUSD per 24 hours
            </p>
          </div>

          {!isConnected ? (
            <Button className="w-full" size="lg" onClick={openConnectModal}>
              Connect Wallet to Claim
            </Button>
          ) : state === "confirmed" && txHash ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-green-500">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Claimed Successfully</span>
              </div>
              <p className="text-sm text-muted-foreground">
                +0.1 STT, +1,000 SUSD
              </p>
              <a
                href={`${EXPLORER_BASE}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                View transaction
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : state === "error" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">Claim Failed</span>
              </div>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto truncate">
                {error?.message ?? "Transaction reverted"}
              </p>
              <Button variant="outline" size="sm" onClick={resetState}>
                Try Again
              </Button>
            </div>
          ) : isFaucetEmpty ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-yellow-500">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">Faucet Depleted</span>
              </div>
              <p className="text-xs text-muted-foreground">
                The faucet does not have enough STT. Please try again later.
              </p>
            </div>
          ) : !canClaim && timeRemaining > 0 ? (
            <div className="space-y-3">
              <Button className="w-full" size="lg" disabled>
                Cooldown Active
              </Button>
              <p className="text-sm text-muted-foreground">
                Next claim in{" "}
                <span className="font-mono font-medium">
                  {formatTimeRemaining(timeRemaining)}
                </span>
              </p>
            </div>
          ) : (
            <Button
              className="w-full"
              size="lg"
              onClick={claim}
              disabled={state === "claiming"}
            >
              {state === "claiming" ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Claiming...
                </span>
              ) : (
                "Claim 0.1 STT + 1,000 SUSD"
              )}
            </Button>
          )}
        </Card>

        {/* Info Card */}
        <Card className="p-4 space-y-2">
          <h3 className="text-sm font-medium">How it works</h3>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>
              <span className="font-medium text-foreground">STT</span> is the
              native gas token for Somnia testnet transactions.
            </li>
            <li>
              <span className="font-medium text-foreground">SUSD</span> is the
              stablecoin used for placing bets on prediction markets.
            </li>
            <li>You can claim once every 24 hours.</li>
          </ul>
          <div className="pt-2 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Faucet balance:{" "}
              <span className="font-mono">
                {formatBalance(faucetSttBalance, 2)} STT
              </span>
            </span>
            <a
              href={`${EXPLORER_BASE}/address/${FAUCET_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Contract
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}
