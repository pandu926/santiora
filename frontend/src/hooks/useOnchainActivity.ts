"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createPublicClient, http, type Address, type Log, decodeAbiParameters } from "viem";
import { CONTRACTS } from "@/lib/config";
import { SANTIORA_REACTIVE_V4, SANTIORA_V4, MARKET_REGISTRY } from "@/lib/onchain";

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
  "0x2ec58fcac54e435c792cafd031489240f2698d3cac500a2eb629752f5e91b795": { type: "skip", title: "Resolve Skipped" },
  "0xed6284157dc881b9863a00a34931271f0ea51fd3309b4659f74fa4227a1e7fb0": { type: "schedule", title: "Next Trigger Scheduled" },
  "0xd73f748f60994ef1532de9ecdd0fed0d80a64263e8127a4cc445862d51ff07ee": { type: "schedule", title: "Loop Started" },
  "0xb762b402a252be1ed76205bab64c5b590c6d878da487bfe332f136b669814858": { type: "system", title: "Loop Reset" },
};

const FINAL_TOPICS: Record<string, { type: OnchainActivity["type"]; title: string }> = {
  "0x4780b74db45b2a5bfcf6c4f1897cc472cd677b7120711da6f43128ffefce0fb1": { type: "agent", title: "Market Creating" },
  "0x7b835820df96a4537e416ab6f587d161ff20f648a4105a243a0df0a222f06ada": { type: "market", title: "Market Active" },
  "0x304bfec5815d6f8897c4f046843c96f3955af24088c0ebceceeccb0cc50fc2fe": { type: "resolve", title: "Market Resolving" },
  "0x6f5d41f2a76d7bf6042360cc32e79d73794e0da4726370ae55bfc6470d6f1759": { type: "resolve", title: "Market Resolved" },
  "0x0b6ee4ec713a0dfdaeac59e6ef793f44e6f921cc94219e9ebe28f32bdfe199d4": { type: "system", title: "Pipeline Failed" },
  "0x56cc21ba6112d780516c0a2b971cae9dce8703614ae89c8248c27024c72e28ca": { type: "agent", title: "Data Gathered" },
  "0x4854fdd5dc9918c439eb840d183210894a4dde0d14c1d79fc2235e1ab8226a33": { type: "agent", title: "Vote Result" },
  "0x975f10e26810671d20a79f3189d8dc0fcdeebc277324b16a3d76b15409eb136e": { type: "agent", title: "Research Loop" },
  "0x9454b637a22b3e97352b407d8a04eb79b5ff2430ccc36a2785d222aa3e5d7e59": { type: "agent", title: "Decision" },
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
  const match = matchTopic(topic0, FINAL_TOPICS);
  if (!match) return null;

  const bn = Number(log.blockNumber);
  const txHash = log.transactionHash || undefined;
  const id = `f-${bn}-${log.logIndex}`;

  let detail = `Block #${bn}`;
  if (match.title === "Market Creating") detail = `Block #${bn} — AI pipeline started for new market`;
  else if (match.title === "Market Active") detail = `Block #${bn} — market live with odds`;
  else if (match.title === "Market Resolving") detail = `Block #${bn} — resolution pipeline started`;
  else if (match.title === "Market Resolved") detail = `Block #${bn} — outcome determined by AI`;
  else if (match.title === "Pipeline Failed") detail = `Block #${bn} — pipeline failed, will retry`;
  else if (match.title === "Data Gathered") detail = `Block #${bn} — data fetched from source`;
  else if (match.title === "Vote Result") detail = `Block #${bn} — AI quorum vote completed`;
  else if (match.title === "Research Loop") detail = `Block #${bn} — deep research round started`;
  else if (match.title === "Decision") detail = `Block #${bn} — AI decision made`;

  return { id, type: match.type, title: match.title, detail, timestamp: 0, txHash, blockNumber: bn };
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
      getLogsChunked(client, SANTIORA_REACTIVE_V4 as Address, fromBlock, toBlock),
      getLogsChunked(client, SANTIORA_V4 as Address, fromBlock, toBlock),
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
