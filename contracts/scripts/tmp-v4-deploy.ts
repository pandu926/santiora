import { ethers } from "hardhat";
async function main(){
  const [d]=await ethers.getSigners();
  console.log("bal:", ethers.formatEther(await ethers.provider.getBalance(d.address)), "STT");

  const Reg=await ethers.getContractFactory("MarketRegistryV2");
  const reg=await Reg.deploy({gasLimit:30_000_000n}); await reg.waitForDeployment();
  const regAddr=await reg.getAddress();
  console.log("reg:", regAddr);
  console.log("reg owner:", await reg.owner());

  const V4=await ethers.getContractFactory("SantioraV4");
  const v4=await V4.deploy(regAddr, {gasLimit:200_000_000n}); await v4.waitForDeployment();
  const v4Addr=await v4.getAddress();
  console.log("v4:", v4Addr);

  // addRegistrar
  console.log("calling addRegistrar...");
  const tx1 = await reg.addRegistrar(v4Addr, {gasLimit:200_000n});
  const r1 = await tx1.wait();
  console.log("addRegistrar status:", r1?.status, "gas:", r1?.gasUsed?.toString());
  console.log("isRegistrar:", await reg.authorizedRegistrars(v4Addr));

  // Fund v4
  console.log("funding v4...");
  const tx2 = await d.sendTransaction({to:v4Addr, value:ethers.parseEther("5"), gasLimit:100_000n});
  const r2 = await tx2.wait();
  console.log("fund status:", r2?.status);
  console.log("v4 bal:", ethers.formatEther(await ethers.provider.getBalance(v4Addr)));

  // Relax interval
  const rules = await v4.rules();
  await(await v4.updateRules({scanInterval:0n,minMarketDuration:rules[1],maxMarketDuration:rules[2],maxMarketsPerDay:rules[3],confidenceThreshold:rules[4],maxRounds:rules[5]},{gasLimit:300_000n})).wait();

  // createMarket
  console.log("\ncreateMarket('sports')...");
  try {
    const tx3 = await (v4 as any)["createMarket(string)"]("sports", {gasLimit:200_000_000n});
    const r3 = await tx3.wait();
    console.log("status:", r3?.status, "gas:", r3?.gasUsed?.toString());
    console.log("marketCount:", (await(v4 as any).getMarketCount()).toString());
    console.log("v4 bal after:", ethers.formatEther(await ethers.provider.getBalance(v4Addr)));
  } catch(e:any) {
    console.log("REVERT:", e.reason || e.message?.slice(0,300));
  }
}
main().catch(e=>console.error(e instanceof Error?e.message:e));
