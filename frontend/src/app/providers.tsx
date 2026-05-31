"use client";

import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { somniaTestnet } from "@/lib/config";
import { SpeedProvider } from "@/contexts/SpeedContext";
import "@rainbow-me/rainbowkit/styles.css";

const config = getDefaultConfig({
  appName: "Santiora",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_ID || "santiora-dev",
  chains: [somniaTestnet],
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <SpeedProvider>
            {children}
          </SpeedProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
