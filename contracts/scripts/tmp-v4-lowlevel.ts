import { ethers } from "hardhat";
async function main(){
  const [d]=await ethers.getSigners();
  console.log("bal:", ethers.formatEther(await ethers.provider.getBalance(d.address)), "STT");

  const Reg=await ethers.getContractFactory("MarketRegistryV2");
  const reg=await Reg.deploy({gasLimit:30_000_000n}); await reg.waitForDeployment();
  const regAddr=await reg.getAddress();
  console.log("reg:", regAddr);

  const V4=await ethers.getContractFactory("SantioraV4");
  const v4=await V4.deploy(regAddr, {gasLimit:200_000_000n}); await v4.waitForDeployment();
  const v4Addr=await v4.getAddress();
  console.log("v4:", v4Addr);

  // Manual encode addRegistrar
  const regIface = Reg.interface;
  const data = regIface.encodeFunctionData("addRegistrar", [v4Addr]);
  console.log("addRegistrar calldata:", data.slice(0,20), "...");

  const tx1 = await d.sendTransaction({to: regAddr, data, gasLimit: 200_000n});
  const r1 = await tx1.wait();
  console.log("addRegistrar status:", r1?.status);

  // Fund
  const tx2 = await d.sendTransaction({to: v4Addr, value: ethers.parseEther("5"), gasLimit: 100_000n});
  const r2 = await tx2.wait();
  console.log("fund status:", r2?.status, "v4 bal:", ethers.formatEther(await ethers.provider.getBalance(v4Addr)));

  // Relax
  const v4iface = V4.interface;
  const rulesData = v4iface.encodeFunctionData("updateRules", [[0n, 86400n, 604800n, 5n, 70n, 3]]);
  const tx3 = await d.sendTransaction({to: v4Addr, data: rulesData, gasLimit: 300_000n});
  await tx3.wait();

  // createMarket
  const createData = v4iface.encodeFunctionData("createMarket(string)", ["sports"]);
  console.log("\ncreateMarket calldata:", createData.slice(0,20), "...");
  const tx4 = await d.sendTransaction({to: v4Addr, data: createData, gasLimit: 200_000_000n});
  const r4 = await tx4.wait();
  console.log("createMarket status:", r4?.status, "gas:", r4?.gasUsed?.toString());

  // Check
  const countData = v4iface.encodeFunctionData("getMarketCount", []);
  const countResult = await ethers.provider.call({to: v4Addr, data: countData});
  console.log("marketCount:", ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], countResult)[0].toString());
  console.log("v4 bal:", ethers.formatEther(await ethers.provider.getBalance(v4Addr)));

  console.log("\nV4:", v4Addr, "\nRegistry:", regAddr);
}
main().catch(e=>console.error(e instanceof Error?e.message:e));
