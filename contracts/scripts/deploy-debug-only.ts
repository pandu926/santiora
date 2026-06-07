import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const bal = await signer.provider.getBalance(signer.address);
  console.log(`Signer: ${signer.address}`);
  console.log(`Balance: ${ethers.formatEther(bal)} STT`);

  // Step 1: Deploy
  console.log("\nDeploying TestToolsDebug...");
  const factory = await ethers.getContractFactory("TestToolsDebug");
  const tx = await factory.getDeployTransaction({ gasLimit: 200_000_000n });
  console.log(`Deploy tx data size: ${tx.data?.toString().length} chars`);

  const deployTx = await signer.sendTransaction({ ...tx, gasLimit: 200_000_000n });
  console.log(`Deploy tx hash: ${deployTx.hash}`);
  console.log("Waiting for confirmation...");

  const receipt = await deployTx.wait(1);
  console.log(`Deployed at: ${receipt?.contractAddress}`);
  console.log(`Gas used: ${receipt?.gasUsed?.toLocaleString()}`);
}

main().catch(e => { console.error("ERROR:", e.message?.slice(0, 300) || e); process.exit(1); });
