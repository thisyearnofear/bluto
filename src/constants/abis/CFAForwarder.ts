export const CFA_FORWARDER_ABI = [
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "receiver", type: "address" },
      { name: "flowrate", type: "int96" },
    ],
    name: "setFlowrate",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "flowrate", type: "int96" },
    ],
    name: "getBufferAmountByFlowrate",
    outputs: [{ name: "bufferAmount", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];
