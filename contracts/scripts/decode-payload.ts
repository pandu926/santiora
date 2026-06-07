import { createPublicClient, http, keccak256, toHex, decodeAbiParameters } from 'viem';
import { defineChain } from 'viem';

const somnia = defineChain({
  id: 50312, name: 'Somnia',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } },
});

const PLATFORM = '0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776' as `0x${string}`;

async function main() {
  const client = createPublicClient({ chain: somnia, transport: http() });
  const currentBlock = await client.getBlockNumber();

  const RequestCreatedTopic = keccak256(toHex('RequestCreated(uint256,uint256,uint256,bytes,address[])'));
  const agentIdHex = '0x' + (12847293847561029384n).toString(16).padStart(64, '0');

  // Get a few requests with selector 0x3bbc1302
  const logs = await (client as any).getLogs({
    address: PLATFORM,
    topics: [RequestCreatedTopic, null, agentIdHex],
    fromBlock: currentBlock - 200n,
    toBlock: currentBlock,
  });

  console.log('Found', logs.length, 'LLM requests in last 200 blocks');

  let found = 0;
  for (const log of logs) {
    try {
      const decoded = decodeAbiParameters(
        [
          { type: 'uint256', name: 'perAgentBudget' },
          { type: 'bytes', name: 'payload' },
          { type: 'address[]', name: 'subcommittee' },
        ],
        log.data
      );
      const payload = decoded[1] as string;
      const selector = '0x' + payload.slice(2, 10);

      if (selector === '0x3bbc1302') {
        found++;
        if (found <= 3) {
          console.log(`\n=== Request with 0x3bbc1302 (#${found}) ===`);
          console.log('RequestId:', BigInt(log.topics[1]).toString());
          console.log('Block:', log.blockNumber?.toString());
          console.log('Payload length:', payload.length);
          console.log('Payload (first 600):', payload.slice(0, 600));
          console.log('Payload (bytes after selector, first 500):', payload.slice(10, 510));

          // Try to decode as various structures
          const data = ('0x' + payload.slice(10)) as `0x${string}`;

          // Try: (string, string, bool, string[]) - inferString
          try {
            const d = decodeAbiParameters(
              [{ type: 'string' }, { type: 'string' }, { type: 'bool' }, { type: 'string[]' }],
              data
            );
            console.log('\nDecoded as inferString(string,string,bool,string[]):');
            console.log('  prompt:', (d[0] as string).slice(0, 200));
            console.log('  system:', (d[1] as string).slice(0, 200));
            console.log('  cot:', d[2]);
            console.log('  allowed:', d[3]);
          } catch {}

          // Try: (string[], string[], bool) - inferChat
          try {
            const d = decodeAbiParameters(
              [{ type: 'string[]' }, { type: 'string[]' }, { type: 'bool' }],
              data
            );
            console.log('\nDecoded as inferChat(string[],string[],bool):');
            console.log('  roles:', d[0]);
            console.log('  messages[0]:', (d[1] as string[])[0]?.slice(0, 200));
            console.log('  cot:', d[2]);
          } catch {}

          // Try: (string[], string[], string[], bytes[], uint256, bool)
          try {
            const d = decodeAbiParameters(
              [{ type: 'string[]' }, { type: 'string[]' }, { type: 'string[]' }, { type: 'bytes[]' }, { type: 'uint256' }, { type: 'bool' }],
              data
            );
            console.log('\nDecoded as inferToolsChat(string[],string[],string[],bytes[],uint256,bool):');
            console.log('  roles:', d[0]);
            console.log('  messages[0]:', (d[1] as string[])[0]?.slice(0, 200));
            console.log('  mcpUrls:', d[2]);
            console.log('  tools:', (d[3] as any[]).length);
            console.log('  maxIter:', d[4]);
            console.log('  cot:', d[5]);
          } catch {}

          // Try: (string, string, int256, int256, bool) - inferNumber
          try {
            const d = decodeAbiParameters(
              [{ type: 'string' }, { type: 'string' }, { type: 'int256' }, { type: 'int256' }, { type: 'bool' }],
              data
            );
            console.log('\nDecoded as inferNumber(string,string,int256,int256,bool):');
            console.log('  prompt:', (d[0] as string).slice(0, 200));
            console.log('  system:', (d[1] as string).slice(0, 100));
            console.log('  min:', d[2]);
            console.log('  max:', d[3]);
          } catch {}
        }
      }
    } catch {}
  }

  console.log('\n\nTotal 0x3bbc1302 found:', found);
}

main().catch(console.error);
