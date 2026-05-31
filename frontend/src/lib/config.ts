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
  SANTIORA_FINAL: "0x41054123916e5840ab5a3846921eaa6343f3Fd55",
  SANTIORA_FINAL_V2: "0x699924676bcea563a3171c916a01a4ccafb63ee8",
  SANTIORA_REACTIVE_V2: "0x9a907ccbf539fe98f76f913d6d8c65190b75d248",
  ORCHESTRATOR: "0xFD11647F8Bc8C37c4d83425Dd1F3E100a35c55D5",
  BRAIN: "0xbf7A28AE7A1a3CF345130aC4e8c0fa9a48BD9A44",
  MARKET_FACTORY: "0x307df7Ec35FbE7F50C7aBE1Ab56a6637Db3A5972",
  PLATFORM: "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776",
  SUSD: "0xB553c0003C3F0419abD358A2edD16191fC86ef90",
  FAUCET: "0xcA33608A3645b532c43Af1C9Ed6ef4b1c5ea4cC1",
} as const;

export const AGENT_IDS = {
  LLM_INFERENCE: "12847293847561029384",
  JSON_API_REQUEST: "13174292974160097713",
  WEB_SCRAPER: "12875401142070969085",
} as const;
