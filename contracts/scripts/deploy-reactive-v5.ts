import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  console.log(`Balance: ${ethers.formatEther(await signer.provider.getBalance(signer.address))} STT\n`);

  const V5_ADDR = "0x6257d213a59f2278692baBB2eAB24Ddc0700B94B";
  const CREATE_INTERVAL = 300n;
  const RESOLVE_INTERVAL = 600n;

  console.log("Deploying SantioraReactiveV5...");
  const factory = await ethers.getContractFactory("SantioraReactiveV5");
  const reactive = await factory.deploy(V5_ADDR, CREATE_INTERVAL, RESOLVE_INTERVAL, { gasLimit: 200_000_000n });
  await reactive.waitForDeployment();
  const reactiveAddr = await reactive.getAddress();
  console.log(`SantioraReactiveV5 deployed: ${reactiveAddr}`);

  // Fund ReactiveV5 with 20 STT
  console.log("\nFunding ReactiveV5 with 20 STT...");
  await (await signer.sendTransaction({ to: reactiveAddr, value: ethers.parseEther("20"), gasLimit: 100_000n })).wait();
  console.log(`ReactiveV5 balance: ${ethers.formatEther(await signer.provider.getBalance(reactiveAddr))} STT`);

  // Fund SantioraV5 with 10 STT
  console.log("\nFunding SantioraV5 with 10 STT...");
  await (await signer.sendTransaction({ to: V5_ADDR, value: ethers.parseEther("10"), gasLimit: 100_000n })).wait();
  console.log(`SantioraV5 balance: ${ethers.formatEther(await signer.provider.getBalance(V5_ADDR))} STT`);

  // setReactiveContract on V5
  console.log("\nSetting reactive contract on SantioraV5...");
  const v5 = new ethers.Contract(V5_ADDR, [
    "function setReactiveContract(address reactive) external",
  ], signer);
  await (await v5.setReactiveContract(reactiveAddr, { gasLimit: 200_000_000n })).wait();
  console.log("reactiveContract set.");

  // Start loops
  console.log("\nStarting create loop...");
  await (await reactive.startCreateLoop({ gasLimit: 200_000_000n })).wait();
  console.log("Create loop started.");

  console.log("Starting resolve loop...");
  await (await reactive.startResolveLoop({ gasLimit: 200_000_000n })).wait();
  console.log("Resolve loop started.");

  console.log("\n=== DONE ===");
  console.log(`SantioraReactiveV5: ${reactiveAddr}`);
  console.log(`SantioraV5:         ${V5_ADDR}`);
  console.log("Both loops active. Markets will auto-create every ~300 blocks.");
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
