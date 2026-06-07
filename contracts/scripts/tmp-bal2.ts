import { ethers } from "hardhat";
async function main(){
  const [d]=await ethers.getSigners();
  console.log("balance:",ethers.formatEther(await ethers.provider.getBalance(d.address)),"STT");
}
main().catch(e=>console.error(e instanceof Error?e.message:e));
