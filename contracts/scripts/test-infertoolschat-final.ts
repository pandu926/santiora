import { createPublicClient, createWalletClient, http, webSocket, encodeFunctionData, decodeFunctionResult, decodeEventLog, BaseError } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PLATFORM_ADDRESS = '0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776' as `0x${string}`;
const RPC_URL = 'https://dream-rpc.somnia.network/';
const WS_URL = 'wss://dream-rpc.somnia.network/ws';
const PER_AGENT_EXECUTION_COST = 100000000000000000n; // 0.1 STT — FIXED from doc
const SUBCOMMITTEE_SIZE = 3n;

const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { decimals: 18, name: 'STT', symbol: 'STT' },
  rpcUrls: { default: { http: [RPC_URL], webSocket: [WS_URL] } },
});

const ResponseStatus = { None: 0, Pending: 1, Success: 2, Failed: 3, TimedOut: 4 } as const;

const platformAbi = [
  {
    type: 'function', name: 'createRequest', stateMutability: 'payable',
    inputs: [
      { type: 'uint256', name: 'agentId' },
      { type: 'address', name: 'callbackAddress' },
      { type: 'bytes4', name: 'callbackSelector' },
      { type: 'bytes', name: 'payload' },
    ],
    outputs: [{ type: 'uint256', name: 'requestId' }],
  },
  {
    type: 'function', name: 'getRequestDeposit', stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256', name: '' }],
  },
  {
    type: 'function', name: 'getRequest', stateMutability: 'view',
    inputs: [{ type: 'uint256', name: 'requestId' }],
    outputs: [{
      type: 'tuple',
      components: [
        { type: 'uint256', name: 'id' },
        { type: 'address', name: 'requester' },
        { type: 'address', name: 'callbackAddress' },
        { type: 'bytes4', name: 'callbackSelector' },
        { type: 'address[]', name: 'subcommittee' },
        { type: 'tuple[]', name: 'responses', components: [
          { type: 'address', name: 'validator' },
          { type: 'bytes', name: 'result' },
          { type: 'uint8', name: 'status' },
          { type: 'uint256', name: 'receipt' },
          { type: 'uint256', name: 'timestamp' },
          { type: 'uint256', name: 'executionCost' },
        ]},
        { type: 'uint256', name: 'responseCount' },
        { type: 'uint256', name: 'failureCount' },
        { type: 'uint256', name: 'threshold' },
        { type: 'uint256', name: 'createdAt' },
        { type: 'uint256', name: 'deadline' },
        { type: 'uint8', name: 'status' },
        { type: 'uint8', name: 'consensusType' },
        { type: 'uint256', name: 'remainingBudget' },
        { type: 'uint256', name: 'perAgentBudget' },
      ],
    }],
  },
  {
    type: 'event', name: 'RequestCreated',
    inputs: [
      { type: 'uint256', name: 'requestId', indexed: true },
      { type: 'uint256', name: 'agentId', indexed: true },
      { type: 'uint256', name: 'perAgentBudget', indexed: false },
      { type: 'bytes', name: 'payload', indexed: false },
      { type: 'address[]', name: 'subcommittee', indexed: false },
    ],
  },
  {
    type: 'event', name: 'RequestFinalized',
    inputs: [
      { type: 'uint256', name: 'requestId', indexed: true },
      { type: 'uint8', name: 'status', indexed: false },
    ],
  },
] as const;

const agentMethodAbi = [{
  type: 'function', name: 'inferToolsChat',
  inputs: [
    { type: 'string[]', name: 'roles' },
    { type: 'string[]', name: 'messages' },
    { type: 'string[]', name: 'mcpServerUrls' },
    { type: 'tuple[]', name: 'onchainTools' },
    { type: 'uint256', name: 'maxIterations' },
    { type: 'bool', name: 'chainOfThought' },
  ],
  outputs: [
    { type: 'string', name: 'finishReason' },
    { type: 'string', name: 'response' },
    { type: 'string[]', name: 'updatedRoles' },
    { type: 'string[]', name: 'updatedMessages' },
    { type: 'string[]', name: 'pendingToolCallIds' },
    { type: 'bytes[]', name: 'pendingToolCalls' },
  ],
}] as const;

async function main() {
  const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`);
  console.log('Wallet:', account.address);

  const walletClient = createWalletClient({ account, chain: somniaTestnet, transport: http(RPC_URL) });
  const readClient = createPublicClient({ chain: somniaTestnet, transport: http(RPC_URL) });
  const eventClient = createPublicClient({ chain: somniaTestnet, transport: webSocket(WS_URL) });

  const balance = await readClient.getBalance({ address: account.address });
  console.log('Balance:', (Number(balance) / 1e18).toFixed(4), 'STT');

  // 1. Encode payload
  const payload = encodeFunctionData({
    abi: agentMethodAbi,
    functionName: 'inferToolsChat',
    args: [
      ['system', 'user'],
      ['You are a helpful AI. Return only valid JSON.', 'Say hello. Return: {"msg":"hello"}'],
      [],   // mcpServerUrls
      [],   // onchainTools
      1n,   // maxIterations
      true, // chainOfThought
    ],
  });
  console.log('\nSelector:', payload.slice(0, 10));

  // 2. Calculate deposit — FIXED: 0.1 per agent × 3
  const reserve = await readClient.readContract({
    address: PLATFORM_ADDRESS,
    abi: platformAbi,
    functionName: 'getRequestDeposit',
  });
  const deposit = (reserve as bigint) + PER_AGENT_EXECUTION_COST * SUBCOMMITTEE_SIZE;
  console.log('Reserve:', Number(reserve) / 1e18, 'STT');
  console.log('Total deposit:', Number(deposit) / 1e18, 'STT');

  // 3. Submit request
  console.log('\nSending inferToolsChat...');
  const hash = await walletClient.writeContract({
    address: PLATFORM_ADDRESS,
    abi: platformAbi,
    functionName: 'createRequest',
    args: [
      12847293847561029384n,
      '0x0000000000000000000000000000000000000000',
      '0x00000000',
      payload,
    ],
    value: deposit,
    gas: 50_000_000n,
  });
  console.log('TX:', hash);

  // 4. Extract requestId
  const receipt = await readClient.waitForTransactionReceipt({ hash, confirmations: 2 });
  console.log('Status:', receipt.status, 'Gas:', receipt.gasUsed.toString());

  let requestId: bigint | undefined;
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({ abi: platformAbi, data: log.data, topics: log.topics as any });
      if (decoded.eventName === 'RequestCreated') {
        requestId = (decoded.args as any).requestId;
        console.log('Request ID:', requestId!.toString());
        console.log('perAgentBudget:', Number((decoded.args as any).perAgentBudget) / 1e18, 'STT');
      }
    } catch {}
  }
  if (!requestId) { console.log('No RequestCreated'); return; }

  // 5. Watch for RequestFinalized
  console.log('\nWatching for RequestFinalized (max 120s)...');
  const { finalizedStatus, finalizedBlockNumber } = await new Promise<{ finalizedStatus: number; finalizedBlockNumber: bigint }>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => { if (!settled) { settled = true; unwatch(); reject(new Error('Timeout')); } }, 120_000);

    const unwatch = (eventClient as any).watchContractEvent({
      address: PLATFORM_ADDRESS,
      abi: platformAbi,
      eventName: 'RequestFinalized',
      onLogs: (logs: any[]) => {
        for (const log of logs) {
          if (log.args.requestId === requestId) {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            unwatch();
            resolve({ finalizedStatus: Number(log.args.status), finalizedBlockNumber: log.blockNumber });
          }
        }
      },
      onError: (error: any) => { if (!settled) { settled = true; clearTimeout(timeout); unwatch(); reject(error); } },
    });
  });

  const statusName = ['None','Pending','Success','Failed','TimedOut'][finalizedStatus];
  console.log(`\nFinalized! Status: ${statusName} (${finalizedStatus}) at block ${finalizedBlockNumber}`);

  if (finalizedStatus !== ResponseStatus.Success) {
    // Read at block before finalize to get error details
    console.log(`\nReading request at block ${finalizedBlockNumber - 1n}...`);
    try {
      const request = await readClient.readContract({
        address: PLATFORM_ADDRESS,
        abi: platformAbi,
        functionName: 'getRequest',
        args: [requestId],
        blockNumber: finalizedBlockNumber - 1n,
      }) as any;
      console.log('Responses:', request.responses?.length);
      if (request.responses?.length > 0) {
        for (let i = 0; i < request.responses.length; i++) {
          const r = request.responses[i];
          console.log(`\n  Response ${i}:`);
          console.log('    validator:', r.validator);
          console.log('    status:', r.status);
          console.log('    result length:', r.result?.length);
          if (r.result && r.result.length > 2) {
            try {
              const buf = Buffer.from(r.result.slice(2), 'hex');
              const str = buf.toString('utf8').replace(/\0/g, '');
              console.log('    result (string):', str.slice(0, 500));
            } catch {}
          }
        }
      }
    } catch (e: any) {
      console.log('getRequest error:', e.message?.slice(0, 200));
    }
    return;
  }

  // 6. SUCCESS — read and decode
  console.log('\n=== SUCCESS! Reading response... ===');
  const request = await readClient.readContract({
    address: PLATFORM_ADDRESS,
    abi: platformAbi,
    functionName: 'getRequest',
    args: [requestId],
    blockNumber: finalizedBlockNumber - 1n,
  }) as any;

  const successResponse = request.responses.find((r: any) => r.status === ResponseStatus.Success);
  if (!successResponse) { console.log('No successful response'); return; }

  const result = decodeFunctionResult({
    abi: agentMethodAbi,
    functionName: 'inferToolsChat',
    data: successResponse.result,
  }) as any;
  console.log('\nfinishReason:', result[0]);
  console.log('response:', result[1]);
  console.log('pendingToolCallIds:', result[4]);
}

main().catch(console.error);
