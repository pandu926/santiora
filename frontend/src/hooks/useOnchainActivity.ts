"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createPublicClient, http, type Address, type Log, decodeAbiParameters } from "viem";
import { CONTRACTS } from "@/lib/config";
import { SANTIORA_REACTIVE_V2, SANTIORA_FINAL_V3, MARKET_REGISTRY } from "@/lib/onchain";

const RPC_URL = "https://dream-rpc.somnia.network";
const POLL_INTERVAL = 15000;
const CHUNK_SIZE = 999n;
const INITIAL_LOOKBACK = 10000n;

export interface OnchainActivity {
  id: string;
  type: "create" | "resolve" | "schedule" | "agent" | "market" | "skip" | "system";
  title: string;
  detail: string;
  timestamp: number;
  txHash?: string;
  blockNumber: number;
}

const REACTIVE_TOPICS: Record<string, { type: OnchainActivity["type"]; title: string }> = {
  "0xa194c386d94467d30c3936073d0353e173a265d987687e5b85fe9d848768b9d6": { type: "create", title: "Create Loop Fired" },
  "0xa16e8248472587d0e53f0034cd17dae545f1adfebe7d0d40815a6dd807df529b": { type: "skip", title: "Create Skipped" },
  "0xef1dde8cb6b8e8919807264eb462e38357dad5b906e10ecc1f2e9d2f09c897cd": { type: "resolve", title: "Resolve Loop Fired" },
  "0xed6284157dc881b9863a00a34931271f0ea51fd3309b4659f74fa4227a1e7fb0": { type: "schedule", title: "Next Trigger Scheduled" },
};

const FINAL_TOPICS: Record<string, { type: OnchainActivity["type"]; title: string }> = {
  "0xd7421b46dbf47b8800000000000000000000000000000000000000000000000000": { type: "agent", title: "Agent Request Sent" },
  "0x4780b74db45b2a5b00000000000000000000000000000000000000000000000000": { type: "agent", title: "Scan Started" },
  "0xf6af599a778ddc5300000000000000000000000000000000000000000000000000": { type: "agent", title: "Brain Response Received" },
  "0x7b83582000000000000000000000000000000000000000000000000000000000": { type: "agent", title: "LLM Decision Made" },
  "0x6045a112961c320200000000000000000000000000000000000000000000000000": { type: "market", title: "Market Event" },
  "0x691c547977213cb600000000000000000000000000000000000000000000000000": { type: "market", title: "Market Registered" },
  "0x304bfec5815d6f8800000000000000000000000000000000000000000000000000": { type: "system", title: "Status Updated" },
  "0xc457a61fea4b8b5c00000000000000000000000000000000000000000000000000": { type: "agent", title: "Agent Callback" },
  "0x1a033cbe1e02984e00000000000000000000000000000000000000000000000000": { type: "resolve", title: "Resolution Triggered" },
  "0x461a044b1f9e1eca00000000000000000000000000000000000000000000000000": { type: "resolve", title: "Market Resolved" },
  "0x0b6ee4ec713a0dfd00000000000000000000000000000000000000000000000000": { type: "system", title: "Config Updated" },
};

function matchTopic(topic: string, map: Record<string, { type: OnchainActivity["type"]; title: string }>): { type: OnchainActivity["type"]; title: string } | null {
  if (map[topic]) return map[topic];
  const prefix = topic.slice(0, 18);
  for (const key of Object.keys(map)) {
    if (key.startsWith(prefix)) return map[key];
  }
  return null;
}

function decodeReactiveLog(log: Log): OnchainActivity | null {
  const topic0 = log.topics[0] || "";
  const match = matchTopic(topic0, REACTIVE_TOPICS);
  if (!match) return null;

  const bn = Number(log.blockNumber);
  const txHash = log.transactionHash || undefined;
  const id = `r-${bn}-${log.logIndex}`;

  let detail = "";
  if (match.title === "Create Loop Fired") {
    detail = `Block #${bn} — triggered market creation via FinalV2`;
  } else if (match.title === "Create Skipped") {
    detail = `Block #${bn} — conditions not met (cooldown or daily limit)`;
  } else if (match.title === "Resolve Loop Fired") {
    detail = `Block #${bn} — scanning expired markets for auto-resolution`;
  } else if (match.title === "Next Trigger Scheduled") {
    detail = `Block #${bn} — self-rescheduled for next interval`;
  }

  return { id, type: match.type, title: match.title, detail, timestamp: 0, txHash, blockNumber: bn };
}

function decodeFinalLog(log: Log): OnchainActivity | null {
  const topic0 = log.topics[0] || "";
  const prefix = topic0.slice(0, 18);

  const bn = Number(log.blockNumber);
  const txHash = log.transactionHash || undefined;
  const id = `f-${bn}-${log.logIndex}`;

  let type: OnchainActivity["type"] = "system";
  let title = "FinalV2 Event";
  let detail = `Block #${bn}`;

  switch (prefix) {
    case "0xd7421b46dbf47b88":
      type = "agent"; title = "Agent Request Created";
      detail = `Block #${bn} — inferToolsChat call to LLM agent`;
      break;
    case "0x4780b74db45b2a5b":
      type = "agent"; title = "Market Scan Started";
      detail = `Block #${bn} — AI brain scanning for opportunities`;
      break;
    case "0xf6af599a778ddc53":
      type = "agent"; title = "Brain Response";
      detail = `Block #${bn} — LLM returned market parameters`;
      break;
    case "0x7b835820df96a453":
      type = "agent"; title = "LLM Decision";
      detail = `Block #${bn} — AI processed creation/resolution logic`;
      break;
    case "0x6045a112961c3202":
      type = "market"; title = "Market Created";
      detail = `Block #${bn} — new prediction market deployed`;
      break;
    case "0x691c547977213cb6":
      type = "market"; title = "Market Registered";
      detail = `Block #${bn} — added to MarketRegistry`;
      break;
    case "0x304bfec5815d6f88":
      type = "system"; title = "Status Change";
      detail = `Block #${bn} — market status updated`;
      break;
    case "0xc457a61fea4b8b5c":
      type = "agent"; title = "Agent Callback";
      detail = `Block #${bn} — platform delivered agent response`;
      break;
    case "0x1a033cbe1e02984e":
      type = "resolve"; title = "Resolution Started";
      detail = `Block #${bn} — auto-resolve triggered for expired market`;
      break;
    case "0x461a044b1f9e1eca":
      type = "resolve"; title = "Market Resolved";
      detail = `Block #${bn} — outcome determined by AI consensus`;
      break;
    case "0x0b6ee4ec713a0dfd":
      type = "system"; title = "Config Updated";
      detail = `Block #${bn} — rules engine parameters changed`;
      break;
    default:
      return null;
  }

  return { id, type, title, detail, timestamp: 0, txHash, blockNumber: bn };
}

async function getLogsChunked(
  client: ReturnType<typeof createPublicClient>,
  address: Address,
  fromBlock: bigint,
  toBlock: bigint
): Promise<Log[]> {
  const all: Log[] = [];
  for (let start = fromBlock; start <= toBlock; start += CHUNK_SIZE) {
    const end = start + CHUNK_SIZE - 1n > toBlock ? toBlock : start + CHUNK_SIZE - 1n;
    try {
      const logs = await client.getLogs({ address, fromBlock: start, toBlock: end });
      all.push(...logs);
    } catch {}
  }
  return all;
}

export function useOnchainActivity(limit: number = 50) {
  const [activities, setActivities] = useState<OnchainActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const lastBlockRef = useRef<bigint>(0n);
  const clientRef = useRef(createPublicClient({ transport: http(RPC_URL) }));

  const fetchLogs = useCallback(async (fromBlock: bigint, toBlock: bigint) => {
    const client = clientRef.current;
    const [rLogs, fLogs] = await Promise.allSettled([
      getLogsChunked(client, SANTIORA_REACTIVE_V2 as Address, fromBlock, toBlock),
      getLogsChunked(client, SANTIORA_FINAL_V3 as Address, fromBlock, toBlock),
    ]);

    const items: OnchainActivity[] = [];
    if (rLogs.status === "fulfilled") {
      for (const log of rLogs.value) {
        const a = decodeReactiveLog(log);
        if (a) items.push(a);
      }
    }
    if (fLogs.status === "fulfilled") {
      for (const log of fLogs.value) {
        const a = decodeFinalLog(log);
        if (a) items.push(a);
      }
    }

    items.sort((a, b) => b.blockNumber - a.blockNumber);
    return items;
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    async function init() {
      const client = clientRef.current;
      const currentBlock = await client.getBlockNumber();
      const fromBlock = currentBlock > INITIAL_LOOKBACK ? currentBlock - INITIAL_LOOKBACK : 0n;

      const items = await fetchLogs(fromBlock, currentBlock);
      setActivities(items.slice(0, limit));
      setLoading(false);
      lastBlockRef.current = currentBlock;
    }

    async function poll() {
      try {
        const client = clientRef.current;
        const currentBlock = await client.getBlockNumber();
        if (currentBlock <= lastBlockRef.current) return;

        const items = await fetchLogs(lastBlockRef.current + 1n, currentBlock);
        lastBlockRef.current = currentBlock;

        if (items.length > 0) {
          setActivities(prev => {
            const merged = [...items, ...prev];
            const unique = merged.filter((v, i, arr) => arr.findIndex(t => t.id === v.id) === i);
            return unique.slice(0, limit);
          });
        }
      } catch {}
    }

    init().then(() => {
      interval = setInterval(poll, POLL_INTERVAL);
    });

    return () => clearInterval(interval);
  }, [limit, fetchLogs]);

  return { activities, loading };
}
