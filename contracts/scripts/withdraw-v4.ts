import { ethers } from "hardhat";

const V4_ADDR = "0xbc2455C2D2d75B70ee97AcDC87da11f6FEd301F3";
const V4_REACTIVE_ADDR = "0x37AF1d85c551D294671c8B6BAFEc1c7dd3cF77aC";
const GAS_RESERVE = ethers.parseEther("0.01");
const GAS_LIMIT = 200_000_000n;

const V4_ABI = [
  "function withdraw(uint256 amount) external",
  "function stopCreateLoop() external",
  "function stopResolveLoop() external",
];

const REACTIVE_V4_ABI = [
  "function withdraw(uint256 amount) external",
];

async function withdrawFrom(
  signer: ethers.Signer,
  label: string,
  addr: string,
  abi: string[],
): Promise<void> {
  const provider = signer.provider!;
  const balance = await provider.getBalance(addr);
  console.log(`\n${label} balance: ${ethers.formatEther(balance)} STT`);

  if (balance <= GAS_RESERVE) {
    console.log(`  Skipping — balance <= reserve (${ethers.formatEther(GAS_RESERVE)} STT)`);
    return;
  }

  const amount = balance - GAS_RESERVE;
  console.log(`  Withdrawing ${ethers.formatEther(amount)} STT (leaving ${ethers.formatEther(GAS_RESERVE)} for gas)`);

  const contract = new ethers.Contract(addr, abi, signer);
  const tx = await contract.withdraw(amount, { gasLimit: GAS_LIMIT });
  const receipt = await tx.wait();
  const status = receipt?.status === 1 ? "SUCCESS" : "FAILED";
  console.log(`  tx: ${tx.hash} [${status}]`);

  const balanceAfter = await provider.getBalance(addr);
  console.log(`  Balance after: ${ethers.formatEther(balanceAfter)} STT`);
}

async function main(): Promise<void> {
  const [signer] = await ethers.getSigners();
  const provider = signer.provider!;

  console.log("=== Withdraw from V4 contracts ===");
  console.log(`Signer: ${signer.address}`);
  console.log(`Signer balance: ${ethers.formatEther(await provider.getBalance(signer.address))} STT`);

  await withdrawFrom(signer, "SantioraV4", V4_ADDR, V4_ABI);
  await withdrawFrom(signer, "SantioraReactiveV4", V4_REACTIVE_ADDR, REACTIVE_V4_ABI);

  const finalBalance = await provider.getBalance(signer.address);
  console.log(`\nSigner balance after: ${ethers.formatEther(finalBalance)} STT`);
  console.log("Done.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
