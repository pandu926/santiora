import { ethers } from "hardhat";
async function main(){
  const [d]=await ethers.getSigners();
  console.log("bal:", ethers.formatEther(await ethers.provider.getBalance(d.address)), "STT");

  const Reg=await ethers.getContractFactory("MarketRegistryV2");
  const reg=await Reg.deploy({gasLimit:30_000_000n}); await reg.waitForDeployment();
  console.log("reg:", await reg.getAddress());

  const V4=await ethers.getContractFactory("SantioraV4");
  const v4=await V4.deploy(await reg.getAddress(), {gasLimit:200_000_000n}); await v4.waitForDeployment();
  const addr=await v4.getAddress();
  console.log("v4:", addr);

  await(await(reg as any).addRegistrar(addr,{gasLimit:500_000n})).wait();
  await(await d.sendTransaction({to:addr,value:ethers.parseEther("5"),gasLimit:100_000n})).wait();
  console.log("funded:", ethers.formatEther(await ethers.provider.getBalance(addr)), "STT");

  // Relax interval
  const r=await(v4 as any).rules();
  await(await(v4 as any).updateRules({scanInterval:0n,minMarketDuration:r[1],maxMarketDuration:r[2],maxMarketsPerDay:r[3],confidenceThreshold:r[4],maxRounds:r[5]},{gasLimit:300_000n})).wait();

  // Try createMarket
  try {
    const tx=await(v4 as any)["createMarket(string)"]("sports",{gasLimit:200_000_000n});
    const rec=await tx.wait();
    console.log("createMarket tx:", tx.hash, "status:", rec.status);
    console.log("marketCount:", (await(v4 as any).getMarketCount()).toString());
    console.log("bal after:", ethers.formatEther(await ethers.provider.getBalance(addr)), "STT");
  } catch(e:any) {
    console.log("createMarket REVERTED:", e.message?.slice(0,200));
  }
}
main().catch(e=>console.error(e instanceof Error?e.message:e));
