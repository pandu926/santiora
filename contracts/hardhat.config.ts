import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      { version: "0.8.24", settings: { viaIR: true, evmVersion: "paris", optimizer: { enabled: true, runs: 200 } } },
      { version: "0.8.30", settings: { viaIR: true, evmVersion: "paris", optimizer: { enabled: true, runs: 200 } } },
    ],
  },
  paths: { sources: "./src", scripts: "./scripts", tests: "./test" },
  networks: {
    somnia: {
      url: process.env.SOMNIA_RPC || "https://dream-rpc.somnia.network",
      accounts: process.env.WALLET_PRIVATE_KEY ? [process.env.WALLET_PRIVATE_KEY] : process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 50312,
    },
  },
};
export default config;
