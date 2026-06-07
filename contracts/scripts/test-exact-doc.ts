import { createPublicClient, createWalletClient, http, encodeFunctionData, decodeEventLog } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const somnia = defineChain({
  id: 50312, name: 'Somnia',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'], webSocket: ['wss://dream-rpc.somnia.network/ws'] } },
});

// EXACT from doc
const PLATFORM_ADDRESS = '0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776' as `0x${string}`;
const RPC_URL = 'https://dream-rpc.somnia.network/';
const PER_AGENT_EXECUTION_COST = 70000000000000000n;
const SUBCOMMITTEE_SIZE = 3n;

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

// EXACT from doc
const agentMethodAbi = [{
  "type": "function",
  "name": "inferToolsChat",
  "inputs": [
    { "type": "string[]", "name": "roles" },
    { "type": "string[]", "name": "messages" },
    { "type": "string[]", "name": "mcpServerUrls" },
    { "type": "tuple[]", "name": "onchainTools" },
    { "type": "uint256", "name": "maxIterations" },
    { "type": "bool", "name": "chainOfThought" }
  ],
  "outputs": [
    { "type": "string", "name": "finishReason" },
    { "type": "string", "name": "response" },
    { "type": "string[]", "name": "updatedRoles" },
    { "type": "string[]", "name": "updatedMessages" },
    { "type": "string[]", "name": "pendingToolCallIds" },
    { "type": "bytes[]", "name": "pendingToolCalls" }
  ]
}] as const;

async function invokeAgent() {
  const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`);
  console.log('Wallet:', account.address);

  const walletClient = createWalletClient({
    account,
    chain: somnia,
    transport: http(RPC_URL)
  });

  const publicClient = createPublicClient({
    chain: somnia,
    transport: http(RPC_URL)
  });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log('Balance:', (Number(balance) / 1e18).toFixed(4), 'STT');

  // 1. Encode the agent function call (selector + parameters)
  const payload = encodeFunctionData({
    abi: agentMethodAbi,
    functionName: 'inferToolsChat',
    args: [
      ['system', 'user'],
      ['You are a helpful assistant. Return only JSON.', 'Say hello. Return: {"msg":"hello"}'],
      [],   // mcpServerUrls
      [],   // onchainTools
      1n,   // maxIterations
      true  // chainOfThought
    ]
  });

  console.log('\nPayload selector:', payload.slice(0, 10));
  console.log('Payload length:', payload.length);

  // 2. Safe deposit
  const reserve = await publicClient.readContract({
    address: PLATFORM_ADDRESS,
    abi: platformAbi,
    functionName: 'getRequestDeposit'
  }) as bigint;
  const reward = PER_AGENT_EXECUTION_COST * SUBCOMMITTEE_SIZE;
  const deposit = reserve + reward;
  console.log('Reserve:', Number(reserve) / 1e18, 'STT');
  console.log('Total deposit:', Number(deposit) / 1e18, 'STT');

  // 3. Send request (no callback)
  console.log('\nSending createRequest...');
  const hash = await walletClient.writeContract({
    address: PLATFORM_ADDRESS,
    abi: platformAbi,
    functionName: 'createRequest',
    args: [
      12847293847561029384n, // agentId
      '0x0000000000000000000000000000000000000000', // no callback
      '0x00000000', // no callback selector
      payload
    ],
    value: deposit,
    gas: 50_000_000n
  });

  console.log('TX:', hash);

  // 4. Wait for transaction
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
        console.log('Request ID:', requestId!.toString());
        console.log('perAgentBudget:', Number((decoded.args as any).perAgentBudget) / 1e18, 'STT');
        console.log('subcommittee:', (decoded.args as any).subcommittee);
      }
    } catch {}
  }

  if (!requestId) {
    console.log('\nNo RequestCreated event found');
    console.log('Logs count:', receipt.logs.length);
    for (const log of receipt.logs) {
      console.log('  addr:', log.address, 'topic0:', log.topics[0]?.slice(0, 10));
    }
    return;
  }

  // 5. Watch for RequestFinalized — poll logs since we can't use websocket easily
  console.log('\nWatching for RequestFinalized event (max 90s)...');
  const startBlock = receipt.blockNumber;
  const startTime = Date.now();

  while (Date.now() - startTime < 90_000) {
    await new Promise(r => setTimeout(r, 5000));
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    const currentBlock = await publicClient.getBlockNumber();
    const logs = await publicClient.getLogs({
      address: PLATFORM_ADDRESS,
      event: {
        type: 'event', name: 'RequestFinalized',
        inputs: [
          { type: 'uint256', name: 'requestId', indexed: true },
          { type: 'uint8', name: 'status', indexed: false }
        ]
      },
      fromBlock: startBlock,
      toBlock: currentBlock,
      args: { requestId }
    });

    if (logs.length > 0) {
      const status = Number(logs[0].args.status);
      const statusName = ['None','Pending','Success','Failed','TimedOut'][status];
      console.log(`\n[${elapsed}s] RequestFinalized! Status: ${statusName} (${status})`);

      if (status === 2) {
        console.log('\n=== SUCCESS! inferToolsChat WORKS ===');
      } else {
        console.log('\n=== FAILED ===');
      }
      return;
    }
    console.log(`[${elapsed}s] waiting... (scanned blocks ${startBlock}-${currentBlock})`);
  }
  console.log('\nTimeout 90s. No RequestFinalized event found.');
}

invokeAgent().catch(console.error);
