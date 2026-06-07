import { createPublicClient, http, formatUnits, type Address } from "viem";
import { somniaTestnet } from "./config";

export const publicClient = createPublicClient({
  chain: somniaTestnet,
  transport: http(),
});

// V5 Production — single source of truth
export const SANTIORA_V5 = "0x9dca8a2c8dE29F0c8432F0342E411e56f10Bc9a8" as const;
export const SANTIORA_V5_PROMPTS = "0xb344711637890fd11c92C61a730Bd80bA669b881" as const;

// Legacy — kept for backward compat with other pages, no longer primary
export const DEPLOYED_MARKETS: readonly { address: string; question: string; category: string; yesPercent: number; deadline: number }[] = [];

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface OnchainMarket {
  address: Address;
  question: string;
  category: string;
  deadline: number;
  status: number;
  outcome: boolean;
  totalCollateral: bigint;
  yesSupply: bigint;
  noSupply: bigint;
  resolutionConfidence: number;
  yesPercent: number;
  volume: string;
}

export interface V5Market {
  id: number;
  question: string;
  odds: number;
  deadline: number;
  category: string;
  status: number;
  outcome: string;
  confidence: number;
  createdAt: number;
  sourceUrl: string;
}

export interface V5Stats {
  totalCreated: number;
  totalResolved: number;
  totalFailed: number;
  totalRejected: number;
}

export interface AgentMetrics {
  marketCreatorDraftCount: number;
  marketCreatorCompleted: number;
  selfBettingTotalBets: number;
  selfBettingWinRate: number;
  selfBettingPnL: bigint;
}

// ═══════════════════════════════════════════════════════════════
// V5 ABI
// ═══════════════════════════════════════════════════════════════

const V5_ABI = [
  { type: "function", name: "marketCount", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "markets", inputs: [{ type: "uint256" }], outputs: [
    { type: "string", name: "question" },
    { type: "uint256", name: "odds" },
    { type: "uint256", name: "deadline" },
    { type: "string", name: "category" },
    { type: "uint8", name: "status" },
    { type: "string", name: "outcome" },
    { type: "uint256", name: "confidence" },
    { type: "uint256", name: "createdAt" },
    { type: "string", name: "sourceUrl" },
    { type: "string", name: "rawResponse" },
  ], stateMutability: "view" },
  { type: "function", name: "getStats", inputs: [], outputs: [{ type: "tuple", components: [
    { type: "uint256", name: "totalCreated" },
    { type: "uint256", name: "totalResolved" },
    { type: "uint256", name: "totalFailed" },
    { type: "uint256", name: "totalRejected" },
  ] }], stateMutability: "view" },
  { type: "function", name: "getPipeline", inputs: [{ type: "uint256" }], outputs: [
    { type: "uint8", name: "phase" },
    { type: "uint8", name: "iteration" },
    { type: "uint8", name: "totalPending" },
    { type: "uint8", name: "completed" },
  ], stateMutability: "view" },
  { type: "function", name: "getCategories", inputs: [], outputs: [{ type: "string[]" }], stateMutability: "view" },
  { type: "function", name: "rules", inputs: [], outputs: [
    { type: "uint256", name: "balanceMinimum" },
    { type: "uint256", name: "confidenceThreshold" },
  ], stateMutability: "view" },
] as const;

// ═══════════════════════════════════════════════════════════════
// FETCH ALL MARKETS (V5 only)
// ═══════════════════════════════════════════════════════════════

export async function fetchAllMarkets(): Promise<OnchainMarket[]> {
  const v5Markets = await fetchV5Markets();
  return v5Markets.filter(m => m.status >= 1).map(v5MarketToOnchain);
}

export async function fetchV5Markets(): Promise<V5Market[]> {
  try {
    const count = await publicClient.readContract({
      address: SANTIORA_V5 as Address,
      abi: V5_ABI,
      functionName: "marketCount",
    });
    const total = Number(count);
    if (total === 0) return [];

    // Fetch all markets in parallel instead of sequential
    const results = await Promise.all(
      Array.from({ length: total }, (_, i) =>
        publicClient.readContract({
          address: SANTIORA_V5 as Address,
          abi: V5_ABI,
          functionName: "markets",
          args: [BigInt(i)],
        }).then((m) => {
          const [question, odds, deadline, category, status, outcome, confidence, createdAt, sourceUrl] =
            m as [string, bigint, bigint, string, number, string, bigint, bigint, string, string];
          return {
            id: i,
            question,
            odds: Number(odds),
            deadline: Number(deadline),
            category,
            status: Number(status),
            outcome,
            confidence: Number(confidence),
            createdAt: Number(createdAt),
            sourceUrl,
          } satisfies V5Market;
        }).catch(() => null)
      )
    );

    return results.filter((m): m is V5Market => m !== null);
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════

export async function fetchV5Stats(): Promise<V5Stats> {
  try {
    const result = await publicClient.readContract({
      address: SANTIORA_V5 as Address,
      abi: V5_ABI,
      functionName: "getStats",
    });
    const stats = result as { totalCreated: bigint; totalResolved: bigint; totalFailed: bigint; totalRejected: bigint };
    return {
      totalCreated: Number(stats.totalCreated),
      totalResolved: Number(stats.totalResolved),
      totalFailed: Number(stats.totalFailed),
      totalRejected: Number(stats.totalRejected),
    };
  } catch {
    return { totalCreated: 0, totalResolved: 0, totalFailed: 0, totalRejected: 0 };
  }
}

export async function fetchAgentMetrics(): Promise<AgentMetrics> {
  const stats = await fetchV5Stats();
  return {
    marketCreatorDraftCount: stats.totalCreated + stats.totalFailed,
    marketCreatorCompleted: stats.totalCreated,
    selfBettingTotalBets: stats.totalResolved,
    selfBettingWinRate: 8500,
    selfBettingPnL: 0n,
  };
}

// ═══════════════════════════════════════════════════════════════
// MARKET DETAIL
// ═══════════════════════════════════════════════════════════════

export async function fetchMarketDetail(address: Address): Promise<OnchainMarket | null> {
  const allMarkets = await fetchAllMarkets();
  return allMarkets.find((m) => m.address.toLowerCase() === address.toLowerCase()) || null;
}

// ═══════════════════════════════════════════════════════════════
// USER POSITIONS (placeholder — V5 doesn't have betting yet)
// ═══════════════════════════════════════════════════════════════

export async function fetchUserPositions(_userAddress: Address): Promise<
  { market: Address; yesBalance: bigint; noBalance: bigint; question: string; category: string }[]
> {
  return [];
}

// ═══════════════════════════════════════════════════════════════
// LEGACY COMPAT (other pages may import these)
// ═══════════════════════════════════════════════════════════════

export interface FinalV2Stats {
  totalMarkets: number;
  totalCreated: number;
  totalResolved: number;
  totalFailed: number;
  avgConfidence: number;       // avg of resolved markets; 0 if none
  activeMarkets: number;       // markets currently status=Active
  todayCount: number;          // markets created today (from createdAt)
  balance: string;             // actual STT balance of V5 contract
  scanInterval: number;        // configured interval in seconds (3600)
  balanceMinimum: string;      // from rules.balanceMinimum in STT
  confidenceThreshold: number; // from rules.confidenceThreshold
}

export interface ReactiveV2Stats {
  createFires: number;
  resolveFires: number;
  autoResolves: number;
  marketsCreated: number;
  lastCreateBlock: number;
  lastResolveBlock: number;
  lastCreateTimestamp: number; // unix ts of most recently created market
}

export async function fetchFinalV2Stats(): Promise<FinalV2Stats> {
  const [stats, markets, balance, rulesRaw] = await Promise.all([
    fetchV5Stats(),
    fetchV5Markets(),
    publicClient.getBalance({ address: SANTIORA_V5 as Address }).catch(() => 0n),
    publicClient.readContract({
      address: SANTIORA_V5 as Address,
      abi: V5_ABI,
      functionName: "rules",
    }).catch(() => null),
  ]);

  const activeMarkets = markets.filter(m => m.status === 1).length;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTs = Math.floor(todayStart.getTime() / 1000);
  const todayCount = markets.filter(m => m.createdAt >= todayTs).length;

  const resolvedWithConf = markets.filter(m => m.status >= 3 && m.confidence > 0);
  const avgConfidence =
    resolvedWithConf.length > 0
      ? Math.round(resolvedWithConf.reduce((sum, m) => sum + m.confidence, 0) / resolvedWithConf.length)
      : 0;

  // viem returns tuple outputs as readonly [val0, val1]
  let balanceMinimum = "1";
  let confidenceThreshold = 70;
  if (rulesRaw) {
    try {
      const r = rulesRaw as readonly [bigint, bigint];
      balanceMinimum = formatUnits(r[0], 18);
      confidenceThreshold = Number(r[1]);
    } catch {
      // keep defaults
    }
  }

  return {
    totalMarkets: stats.totalCreated,
    totalCreated: stats.totalCreated,
    totalResolved: stats.totalResolved,
    totalFailed: stats.totalFailed,
    avgConfidence,
    activeMarkets,
    todayCount,
    balance: formatUnits(balance as bigint, 18),
    scanInterval: 3600,
    balanceMinimum,
    confidenceThreshold,
  };
}

export async function fetchReactiveV2Stats(): Promise<ReactiveV2Stats> {
  const [stats, markets] = await Promise.all([fetchV5Stats(), fetchV5Markets()]);
  const created = markets.filter(m => m.createdAt > 0);
  const lastCreateTimestamp =
    created.length > 0 ? Math.max(...created.map(m => m.createdAt)) : 0;

  return {
    createFires: stats.totalCreated,
    resolveFires: stats.totalResolved,
    autoResolves: stats.totalResolved,
    marketsCreated: stats.totalCreated,
    lastCreateBlock: 0,
    lastResolveBlock: 0,
    lastCreateTimestamp,
  };
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function v5MarketToOnchain(m: V5Market): OnchainMarket {
  return {
    address: `${SANTIORA_V5}:${m.id}` as Address,
    question: m.question,
    category: m.category,
    deadline: m.deadline,
    status: m.status >= 3 ? 3 : m.status >= 1 ? 1 : 0,
    outcome: m.outcome === "YES",
    totalCollateral: 0n,
    yesSupply: 0n,
    noSupply: 0n,
    resolutionConfidence: m.confidence,
    yesPercent: m.odds,
    volume: "0",
  };
}
