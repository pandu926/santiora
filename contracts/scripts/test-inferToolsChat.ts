import { createPublicClient, createWalletClient, http, encodeFunctionData, decodeFunctionResult, decodeEventLog } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const somnia = defineChain({
  id: 50312,
  name: 'Somnia',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } },
});

const PLATFORM_ADDRESS = '0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776' as `0x${string}`;
const RPC_URL = 'https://dream-rpc.somnia.network/';
const PER_AGENT_EXECUTION_COST = 70000000000000000n;
const SUBCOMMITTEE_SIZE = 3n;

const ResponseStatus = {
  None: 0,
  Pending: 1,
  Success: 2,
  Failed: 3,
  TimedOut: 4
} as const;

const platformAbi = [
  {
    type: 'function', name: 'createRequest', stateMutability: 'payable',
    inputs: [
      { type: 'uint256', name: 'agentId' },
      { type: 'address', name: 'callbackAddress' },
      { type: 'bytes4', name: 'callbackSelector' },
      { type: 'bytes', name: 'payload' }
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
          { type: 'uint256', name: 'executionCost' }
        ]},
        { type: 'uint256', name: 'responseCount' },
        { type: 'uint256', name: 'failureCount' },
        { type: 'uint256', name: 'threshold' },
        { type: 'uint256', name: 'createdAt' },
        { type: 'uint256', name: 'deadline' },
        { type: 'uint8', name: 'status' },
        { type: 'uint8', name: 'consensusType' },
        { type: 'uint256', name: 'remainingBudget' },
        { type: 'uint256', name: 'perAgentBudget' }
      ]
    }],
  },
  {
    type: 'event', name: 'RequestCreated',
    inputs: [
      { type: 'uint256', name: 'requestId', indexed: true },
      { type: 'uint256', name: 'agentId', indexed: true },
      { type: 'uint256', name: 'perAgentBudget', indexed: false },
      { type: 'bytes', name: 'payload', indexed: false },
      { type: 'address[]', name: 'subcommittee', indexed: false }
    ]
  },
  {
    type: 'event', name: 'RequestFinalized',
    inputs: [
      { type: 'uint256', name: 'requestId', indexed: true },
      { type: 'uint8', name: 'status', indexed: false }
    ]
  }
] as const;

const agentMethodAbi = [{
  type: 'function', name: 'inferToolsChat',
  inputs: [
    { type: 'string[]', name: 'roles' },
    { type: 'string[]', name: 'messages' },
    { type: 'string[]', name: 'mcpServerUrls' },
    { type: 'tuple[]', name: 'onchainTools', components: [] },
    { type: 'uint256', name: 'maxIterations' },
    { type: 'bool', name: 'chainOfThought' }
  ],
  outputs: [
    { type: 'string', name: 'finishReason' },
    { type: 'string', name: 'response' },
    { type: 'string[]', name: 'updatedRoles' },
    { type: 'string[]', name: 'updatedMessages' },
    { type: 'string[]', name: 'pendingToolCallIds' },
    { type: 'bytes[]', name: 'pendingToolCalls' }
  ]
}] as const;

async function main() {
  const privateKey = process.env.WALLET_PRIVATE_KEY as `0x${string}`;
  if (!privateKey) throw new Error('WALLET_PRIVATE_KEY not set');

  const account = privateKeyToAccount(privateKey);
  console.log('Wallet:', account.address);

  const publicClient = createPublicClient({ chain: somnia, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, chain: somnia, transport: http(RPC_URL) });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log('Balance:', (Number(balance) / 1e18).toFixed(4), 'STT');

  // Platform confirmed working (proxy → 0xc49e656bd...)

  // 1. Encode inferToolsChat payload
  const payload = encodeFunctionData({
    abi: agentMethodAbi,
    functionName: 'inferToolsChat',
    args: [
      ['system', 'user'],
      [
        'You are Santiora AI. Today is May 31, 2026. Create prediction markets about real upcoming events.',
        'Create a YES/NO prediction market about a sports event June 1-7, 2026. Return JSON: {"question":"...","odds":50,"category":"sports","reasoning":"..."}'
      ],
      [], // mcpServerUrls
      [], // onchainTools
      1n, // maxIterations
      true // chainOfThought
    ]
  });

  console.log('\nPayload encoded, length:', payload.length);

  // 2. Get deposit
  const reserve = await publicClient.readContract({
    address: PLATFORM_ADDRESS,
    abi: platformAbi,
    functionName: 'getRequestDeposit'
  });
  const reward = PER_AGENT_EXECUTION_COST * SUBCOMMITTEE_SIZE;
  const deposit = (reserve as bigint) + reward;
  console.log('Reserve:', Number(reserve) / 1e18, 'STT');
  console.log('Reward:', Number(reward) / 1e18, 'STT');
  console.log('Total deposit:', Number(deposit) / 1e18, 'STT');

  // 3. Send request
  console.log('\nSending inferToolsChat request...');
  const hash = await walletClient.writeContract({
    address: PLATFORM_ADDRESS,
    abi: platformAbi,
    functionName: 'createRequest',
    args: [
      12847293847561029384n,
      '0x0000000000000000000000000000000000000000',
      '0x00000000',
      payload
    ],
    value: deposit,
    gas: 10_000_000n,
  });
  console.log('TX:', hash);

  // 4. Wait for receipt
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('Status:', receipt.status);
  console.log('Gas used:', receipt.gasUsed.toString());

  // Extract requestId
  let requestId: bigint | undefined;
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({ abi: platformAbi, data: log.data, topics: log.topics as any });
      if (decoded.eventName === 'RequestCreated') {
        requestId = (decoded.args as any).requestId;
        break;
      }
    } catch {}
  }

  if (!requestId) {
    console.error('\nRequestCreated not found. Logs:');
    receipt.logs.forEach((l, i) => console.log(`  ${i}: addr=${l.address} topics=${l.topics.length}`));
    return;
  }

  console.log('\nRequest ID:', requestId.toString());
  console.log('Polling for response (max 120s)...');

  // 5. Poll
  const startTime = Date.now();
  while (Date.now() - startTime < 120_000) {
    await new Promise(r => setTimeout(r, 5000));

    const request = await publicClient.readContract({
      address: PLATFORM_ADDRESS,
      abi: platformAbi,
      functionName: 'getRequest',
      args: [requestId]
    }) as any;

    const status = Number(request.status);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`  [${elapsed}s] status=${['None','Pending','Success','Failed','TimedOut'][status]} responses=${request.responseCount}`);

    if (status === ResponseStatus.Success) {
      console.log('\n=== SUCCESS ===');
      const responseBytes = request.responses[0].result;
      console.log('Response bytes length:', responseBytes.length);
      try {
        const results = decodeFunctionResult({
          abi: agentMethodAbi,
          functionName: 'inferToolsChat',
          data: responseBytes
        }) as any;
        console.log('Finish reason:', results[0]);
        console.log('Response:', results[1]);
        console.log('Updated roles count:', results[2]?.length);
        console.log('Updated messages (last):', results[3]?.slice(-1)?.[0]?.slice(0, 300));
        console.log('Pending tool call IDs:', results[4]);
        console.log('Pending tool calls count:', results[5]?.length);
      } catch (e: any) {
        console.log('Decode error, trying raw...');
        console.log('Raw hex (first 200):', responseBytes.slice(0, 200));
      }
      break;
    } else if (status >= ResponseStatus.Failed) {
      console.log('\nFAILED:', ['None','Pending','Success','Failed','TimedOut'][status]);
      break;
    }
  }

  if (Date.now() - startTime >= 120_000) {
    console.log('\nTimeout. Request may still be processing on-chain.');
  }
}

main().catch(console.error);
