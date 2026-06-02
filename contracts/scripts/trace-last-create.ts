import { ethers } from "hardhat";

const TX = "0x21c7fb55fbaedfd88514ee0f0d39d5a323347cfb892061e48c7e304368f74f20";

async function main(): Promise<void> {
  const provider = ethers.provider;
  const rc = await provider.getTransactionReceipt(TX);
  if (!rc) { console.log("No receipt"); return; }
  console.log(`block=${rc.blockNumber} status=${rc.status} gas=${rc.gasUsed} logs=${rc.logs.length}`);
  for (const l of rc.logs) {
    console.log(`\n from=${l.address}`);
    console.log(`   t0=${l.topics[0]}`);
    for (let i = 1; i < l.topics.length; i++) console.log(`   t${i}=${l.topics[i]}`);
    try {
      const d = ethers.AbiCoder.defaultAbiCoder().decode(["uint256","string"], l.data);
      console.log(`   decoded: mid=${d[0]} msg="${d[1]}"`);
    } catch {
      try {
        const d = ethers.AbiCoder.defaultAbiCoder().decode(["string"], l.data);
        console.log(`   string: "${d[0]}"`);
      } catch {
        try {
          const d = ethers.AbiCoder.defaultAbiCoder().decode(["uint256","string","string"], l.data);
          console.log(`   d3: mid=${d[0]} a="${d[1]}" b="${d[2]}"`);
        } catch {
          console.log(`   raw: ${l.data.slice(0, 200)}`);
        }
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
