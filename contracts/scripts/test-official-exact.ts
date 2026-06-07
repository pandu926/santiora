import { createPublicClient, createWalletClient, http, encodeFunctionData, decodeEventLog } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const somnia = defineChain({
  id: 50312, name: 'Somnia',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } },
});

const PLATFORM_ADDRESS = '0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776' as `0x${string}`;
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

// EXACT copy from official doc — tuple[] with no components
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

async function main() {
  const privateKey = process.env.WALLET_PRIVATE_KEY as `0x${string}`;
  const account = privateKeyToAccount(privateKey);
  console.log('Wallet:', account.address);

  const publicClient = createPublicClient({ chain: somnia, transport: http() });
  const walletClient = createWalletClient({ account, chain: somnia, transport: http() });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log('Balance:', (Number(balance) / 1e18).toFixed(4), 'STT');

  // Encode EXACTLY like official doc
  const payload = encodeFunctionData({
    abi: agentMethodAbi,
    functionName: 'inferToolsChat',
    args: [
      ['system', 'user'],
      ['You are a helpful AI. Return only JSON.', 'Say hello. Return: {"msg":"hello"}'],
      [],  // mcpServerUrls
      [],  // onchainTools (empty tuple[])
      1n,  // maxIterations
      true // chainOfThought
    ]
  });

  console.log('Payload selector:', payload.slice(0, 10));
  console.log('Payload length:', payload.length);

  // Calculate deposit exactly like doc
  const reserve = await publicClient.readContract({
    address: PLATFORM_ADDRESS,
    abi: platformAbi,
    functionName: 'getRequestDeposit'
  }) as bigint;
  const reward = PER_AGENT_EXECUTION_COST * SUBCOMMITTEE_SIZE;
  const deposit = reserve + reward;
  console.log('Deposit:', Number(deposit) / 1e18, 'STT');

  // Send request — NO callback, poll via getRequest
  console.log('\nSending...');
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
    gas: 50_000_000n
  });
  console.log('TX:', hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('Status:', receipt.status, 'Gas:', receipt.gasUsed.toString());

  // Extract requestId
  let requestId: bigint | undefined;
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({ abi: platformAbi, data: log.data, topics: log.topics as any });
      if (decoded.eventName === 'RequestCreated') {
        requestId = (decoded.args as any).requestId;
      }
    } catch {}
  }
  if (!requestId) { console.log('No RequestCreated event'); return; }
  console.log('Request ID:', requestId.toString());

  // Poll via getRequest
  console.log('\nPolling (max 90s)...');
  const start = Date.now();
  while (Date.now() - start < 90_000) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const req = await publicClient.readContract({
        address: PLATFORM_ADDRESS,
        abi: platformAbi,
        functionName: 'getRequest',
        args: [requestId],
      }) as any;

      const status = Number(req.status);
      const elapsed = Math.round((Date.now() - start) / 1000);
      console.log(`[${elapsed}s] status=${['None','Pending','Success','Failed','TimedOut'][status]} responses=${req.responseCount}`);

      if (status === 2) {
        console.log('\nSUCCESS!');
        const result = req.responses[0].result;
        console.log('Result length:', result.length);
        // Try decode
        try {
          const { AbiCoder } = await import('ethers');
          const coder = AbiCoder.defaultAbiCoder();
          const decoded = coder.decode(
            ['string', 'string', 'string[]', 'string[]', 'string[]', 'bytes[]'],
            result
          );
          console.log('finishReason:', decoded[0]);
          console.log('response:', decoded[1]);
        } catch (e: any) {
          console.log('Raw (first 200):', result.slice(0, 200));
        }
        return;
      } else if (status >= 3) {
        console.log('\nFAILED. Status:', status);
        if (req.responses?.length > 0) {
          console.log('Failure response:', req.responses[0].result?.slice(0, 100));
        }
        return;
      }
    } catch (e: any) {
      // getRequest might revert — try with higher gas or different approach
      const elapsed = Math.round((Date.now() - start) / 1000);
      console.log(`[${elapsed}s] getRequest error:`, e.message?.slice(0, 100));
    }
  }
  console.log('Timeout.');
}

main().catch(console.error);
