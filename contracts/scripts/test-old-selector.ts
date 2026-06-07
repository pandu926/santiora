import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "STT");

  const PLATFORM = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";
  const LLM_AGENT_ID = 12847293847561029384n;
  const DEPOSIT = ethers.parseEther("0.24");

  // Use existing TestToolsFinal contract
  const addr = "0x516daFb489FA6189FD6A9BaF941C0F918FC1FDF8";
  const contract = await ethers.getContractAt("TestToolsFinal", addr);

  // Fund more
  await (await deployer.sendTransaction({ to: addr, value: ethers.parseEther("1"), gasLimit: 100_000n })).wait();

  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  // Test OLD signature: inferToolsChat(string[],string[],string,bool) = 0xc664d2ec
  console.log("\n=== Test: OLD signature (string[] roles, string[] messages, string toolsJson, bool cot) ===");
  const paramsOld = abiCoder.encode(
    ["string[]", "string[]", "string", "bool"],
    [
      ["system", "user"],
      ["You are a helpful AI. Return only JSON.", 'Say hello. Return: {"msg":"hello"}'],
      "[]", // toolsJson as empty JSON array string
      true
    ]
  );
  const payloadOld = "0xc664d2ec" + paramsOld.slice(2);
  console.log("Selector: 0xc664d2ec");
  console.log("Payload length:", payloadOld.length);

  const tx1 = await contract.sendRawPayload(payloadOld, { gasLimit: 50_000_000n });
  await tx1.wait();
  const reqId1 = await contract.toolsRequestId();
  console.log("Request ID:", reqId1.toString());

  // Wait for response
  console.log("Waiting 15s...");
  await new Promise(r => setTimeout(r, 15000));
  let res = await contract.getResult();
  let statusName = ["None","Pending","Success","Failed","TimedOut"][Number(res[1])];
  console.log("Status:", statusName, "rawLen:", res[2].toString());

  if (Number(res[1]) === 2 && Number(res[2]) > 0) {
    const raw = await contract.getRawResult();
    console.log("Raw (first 300):", raw.slice(0, 300));
    try {
      const decoded = abiCoder.decode(["string", "string", "string[]", "string[]", "string[]", "string[]"], raw);
      console.log("finishReason:", decoded[0]);
      console.log("response:", decoded[1]);
    } catch {
      try {
        const decoded = abiCoder.decode(["string"], raw);
        console.log("Decoded as string:", decoded[0]);
      } catch {
        console.log("Could not decode");
      }
    }
    return;
  }

  if (Number(res[1]) === 3) {
    console.log("FAILED — trying next variant...");
  }

  // Test: inferToolsChat(string[],string[],string[],string[],uint256,bool) = 0x4f48fdb0
  // onchainTools as string[] (JSON tool definitions)
  console.log("\n=== Test: string[] for tools ===");
  const params2 = abiCoder.encode(
    ["string[]", "string[]", "string[]", "string[]", "uint256", "bool"],
    [
      ["system", "user"],
      ["You are a helpful AI. Return only JSON.", 'Say hello. Return: {"msg":"hello"}'],
      [], // mcpServerUrls
      [], // onchainTools as string[]
      1,
      true
    ]
  );
  const payload2 = "0x4f48fdb0" + params2.slice(2);
  console.log("Selector: 0x4f48fdb0");

  const tx2 = await contract.sendRawPayload(payload2, { gasLimit: 50_000_000n });
  await tx2.wait();
  const reqId2 = await contract.toolsRequestId();
  console.log("Request ID:", reqId2.toString());

  console.log("Waiting 15s...");
  await new Promise(r => setTimeout(r, 15000));
  res = await contract.getResult();
  statusName = ["None","Pending","Success","Failed","TimedOut"][Number(res[1])];
  console.log("Status:", statusName, "rawLen:", res[2].toString());

  if (Number(res[1]) === 2 && Number(res[2]) > 0) {
    const raw = await contract.getRawResult();
    try {
      const decoded = abiCoder.decode(["string", "string", "string[]", "string[]", "string[]", "bytes[]"], raw);
      console.log("finishReason:", decoded[0]);
      console.log("response:", decoded[1]);
    } catch {
      console.log("Raw:", raw.slice(0, 300));
    }
  }
}

main().catch(console.error);
