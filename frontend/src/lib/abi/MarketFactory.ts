export const MARKET_FACTORY_ABI = [
  {
    inputs: [],
    name: "getMarketCount",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { type: "uint256", name: "offset" },
      { type: "uint256", name: "limit" },
    ],
    name: "getMarkets",
    outputs: [{ type: "address[]", name: "result" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "bytes32", name: "category" }],
    name: "getMarketsByCategory",
    outputs: [{ type: "address[]", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "uint256", name: "" }],
    name: "markets",
    outputs: [{ type: "address", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "address", name: "" }],
    name: "isMarket",
    outputs: [{ type: "bool", name: "" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
