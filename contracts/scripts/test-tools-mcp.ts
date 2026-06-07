import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "STT");

  // Use existing TestToolsFinal contract
  const addr = "0x516daFb489FA6189FD6A9BaF941C0F918FC1FDF8";
  const contract = await ethers.getContractAt("TestToolsFinal", addr);

  // Fund more
  await (await deployer.sendTransaction({ to: addr, value: ethers.parseEther("1"), gasLimit: 100_000n })).wait();
  console.log("Funded");

  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  // Test: provide a dummy MCP server URL (maybe it needs at least one)
  const params = abiCoder.encode(
    ["string[]", "string[]", "string[]", "bytes[]", "uint256", "bool"],
    [
      ["system", "user"],
      ["Return only: hello", "Say hello"],
      ["https://example.com/mcp"], // non-empty mcpServerUrls
      [], // onchainTools still empty
      1,
      true
    ]
  );

  // Try with bytes[] selector
  const payload = "0x2acc8247" + params.slice(2);
  console.log("\nTest: with mcpServerUrl, selector 0x2acc8247...");
  const tx = await contract.sendRawPayload(payload, { gasLimit: 50_000_000n });
  await tx.wait();
  const reqId = await contract.toolsRequestId();
  console.log("Request ID:", reqId.toString());

  // Poll
  await new Promise(r => setTimeout(r, 10000));
  const res = await contract.getResult();
  const statusName = ["None","Pending","Success","Failed","TimedOut"][Number(res[1])];
  console.log("Status:", statusName, "rawLen:", res[2].toString());

  if (Number(res[1]) === 2) {
    const raw = await contract.getRawResult();
    try {
      const decoded = abiCoder.decode(["string", "string", "string[]", "string[]", "string[]", "bytes[]"], raw);
      console.log("finishReason:", decoded[0]);
      console.log("response:", decoded[1]);
    } catch {
      console.log("Raw:", raw.slice(0, 200));
    }
  }
}

main().catch(console.error);
