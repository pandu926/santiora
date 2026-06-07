import { ethers } from "hardhat";
async function main() {
  const [signer] = await ethers.getSigners();
  const addr = "0x2Ab790d862cbf89ABe56a9A0e792C2b899a6C6B7";
  const abi = [
    "function startCreateLoop() external",
    "function startResolveLoop() external",
    "function createSubscriptionId() view returns (uint256)",
    "function resolveSubscriptionId() view returns (uint256)",
  ];
  const c = new ethers.Contract(addr, abi, signer);

  // Try estimating gas first to get revert reason
  try {
    const gas = await signer.provider.estimateGas({
      to: addr,
      from: signer.address,
      data: c.interface.encodeFunctionData("startCreateLoop"),
    });
    console.log("estimateGas:", gas.toString());
  } catch(e: any) {
    console.log("estimateGas error:", e.message?.slice(0, 400));
  }

  // Try with value (maybe needs STT for subscription fee)
  try {
    const tx = await c.startCreateLoop({ gasLimit: 200_000_000n, value: ethers.parseEther("1") });
    const r = await tx.wait();
    console.log("startCreateLoop with value: OK", r?.status);
  } catch(e: any) {
    console.log("with value error:", e.message?.slice(0, 400));
  }
}
main().catch(e => { console.error(e.message?.slice(0,400)); process.exit(1); });
