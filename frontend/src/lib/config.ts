import { defineChain } from "viem";

export const somniaTestnet = defineChain({
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://dream-rpc.somnia.network"],
      webSocket: ["wss://dream-rpc.somnia.network/ws"],
    },
  },
  blockExplorers: {
    default: { name: "Somnia Explorer", url: "https://shannon-explorer.somnia.network" },
  },
  testnet: true,
});

export const CONTRACTS = {
  SANTIORA_V5: "0x9dca8a2c8dE29F0c8432F0342E411e56f10Bc9a8",
  SANTIORA_V5_PROMPTS: "0xb344711637890fd11c92C61a730Bd80bA669b881",
  V5_BETTING_POOL: "0x5303c2ba485625DC9eE5A55c6f5e17B2Cf7426C3",
  PLATFORM: "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776",
  SUSD: "0xB553c0003C3F0419abD358A2edD16191fC86ef90",
  FAUCET: "0xcA33608A3645b532c43Af1C9Ed6ef4b1c5ea4cC1",
} as const;

export const AGENT_IDS = {
  LLM_INFERENCE: "12847293847561029384",
  JSON_API_REQUEST: "13174292974160097713",
  WEB_SCRAPER: "12875401142070969085",
} as const;
