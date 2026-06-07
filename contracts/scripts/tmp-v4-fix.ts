import { ethers } from "hardhat";
async function main(){
  const [d]=await ethers.getSigners();
  console.log("bal:", ethers.formatEther(await ethers.provider.getBalance(d.address)));

  const Reg=await ethers.getContractFactory("MarketRegistryV2");
  const reg=await Reg.deploy({gasLimit:30_000_000n}); await reg.waitForDeployment();
  console.log("reg:", await reg.getAddress());

  const V4=await ethers.getContractFactory("SantioraV4");
  const v4=await V4.deploy(await reg.getAddress(), {gasLimit:200_000_000n}); await v4.waitForDeployment();
  const v4Addr=await v4.getAddress();
  console.log("v4:", v4Addr);

  // Gas 5M seperti script V3 lama yang berhasil
  const tx1=await reg.addRegistrar(v4Addr, {gasLimit:5_000_000n});
  const r1=await tx1.wait();
  console.log("addRegistrar:", r1?.status, "gas:", r1?.gasUsed?.toString());

  // Fund — gas 5M juga
  await(await d.sendTransaction({to:v4Addr, value:ethers.parseEther("5"), gasLimit:5_000_000n})).wait();
  console.log("funded:", ethers.formatEther(await ethers.provider.getBalance(v4Addr)));

  // Relax interval
  await(await(v4 as any).updateRules([0n,86400n,604800n,5n,70n,3],{gasLimit:5_000_000n})).wait();
  console.log("rules relaxed");

  // Create
  console.log("createMarket('sports')...");
  const tx=await(v4 as any)["createMarket(string)"]("sports",{gasLimit:200_000_000n});
  const rec=await tx.wait();
  console.log("status:", rec?.status, "gas:", rec?.gasUsed?.toString());
  console.log("marketCount:", (await(v4 as any).getMarketCount()).toString());
  console.log("v4 bal:", ethers.formatEther(await ethers.provider.getBalance(v4Addr)));
  console.log("\nV4:", v4Addr);
}
main().catch(e=>console.error(e instanceof Error?e.message:e));
