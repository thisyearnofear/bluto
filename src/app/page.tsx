"use client";

import { useState, ChangeEvent } from "react";
import { useAccount, useConnect, useDisconnect, useWalletClient } from "wagmi";
import { ConnectKitButton } from "connectkit";
import { Web3Provider } from "@/components/Web3Provider";
import { ethers } from "ethers";

// Add this ABI at the top with your other constants
const ERC20_ABI = [
  {
    constant: true,
    inputs: [
      {
        name: "owner",
        type: "address",
      },
      {
        name: "spender",
        type: "address",
      },
    ],
    name: "allowance",
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      {
        name: "spender",
        type: "address",
      },
      {
        name: "amount",
        type: "uint256",
      },
    ],
    name: "approve",
    outputs: [
      {
        name: "",
        type: "bool",
      },
    ],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
];

const ETHx_ABI = [
  {
    constant: true,
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

function SuperfluidDemo() {
  const { address, isConnected } = useAccount();
  const [tokenAddress] = useState<string>(
    process.env.NEXT_PUBLIC_ETHX_ADDRESS || ""
  );
  const [receiverAddress, setReceiverAddress] = useState<string>("");
  const [flowRate, setFlowRate] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  // Base Sepolia Forwarder Address
  const CFAv1ForwarderAddress = "0xcfA132E353cB4E398080B9700609bb008eceB125";

  // Update the CFA Forwarder ABI to include setFlowrate
  const CFAv1ForwarderABI = [
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

  const { data: walletClient } = useWalletClient();

  const handleReceiverAddressChange = (e: ChangeEvent<HTMLInputElement>) =>
    setReceiverAddress(e.target.value);
  const handleFlowRateChange = (e: ChangeEvent<HTMLInputElement>) =>
    setFlowRate(e.target.value);

  const createStream = async () => {
    if (!isConnected || !walletClient) {
      setMessage("Please connect your wallet first.");
      return;
    }

    // Check if we're on Base Sepolia
    const chainId = await walletClient.getChainId();
    if (chainId !== 84532) {
      setMessage("Please switch to Base Sepolia network");
      return;
    }

    try {
      const provider = new ethers.providers.Web3Provider(walletClient as any);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        CFAv1ForwarderAddress,
        CFAv1ForwarderABI,
        signer
      );

      // Use a higher minimum flow rate (about 0.01 tokens per month)
      const minimumFlowRate = "385802469135"; // approximately 0.01 tokens per month

      // Check buffer amount required
      const bufferAmount = await contract.getBufferAmountByFlowrate(
        tokenAddress,
        minimumFlowRate
      );
      console.log(
        "Required buffer amount:",
        ethers.utils.formatEther(bufferAmount)
      );

      // Check ETHx balance
      const ethxContract = new ethers.Contract(tokenAddress, ETHx_ABI, signer);
      const balance = await ethxContract.balanceOf(address);
      console.log("ETHx balance:", ethers.utils.formatEther(balance));

      if (balance.lt(bufferAmount)) {
        setMessage(
          `Insufficient ETHx balance. Need at least ${ethers.utils.formatEther(
            bufferAmount
          )} ETHx for buffer.`
        );
        return;
      }

      setMessage("Creating stream...");
      console.log("Creating stream with params:", {
        token: tokenAddress,
        receiver: receiverAddress,
        flowRate: minimumFlowRate,
      });

      const tx = await contract.setFlowrate(
        tokenAddress,
        receiverAddress,
        minimumFlowRate,
        {
          gasLimit: 3000000,
        }
      );

      console.log("Stream creation tx sent:", tx.hash);
      const receipt = await tx.wait(2);
      console.log("Transaction status:", receipt.status);

      if (receipt.status === 0) {
        throw new Error(
          "Transaction failed. Check the explorer for more details."
        );
      }

      setMessage("The stream has been created successfully!");
    } catch (error: any) {
      console.error("Detailed error:", {
        error,
        message: error.message,
        reason: error.reason,
        code: error.code,
        data: error.data,
        chainId: await walletClient.getChainId(),
      });

      setMessage(
        error.reason ||
          error.message ||
          "Failed to create stream. Please try again."
      );
    }
  };

  return (
    <div style={{ maxWidth: "500px", margin: "auto", padding: "20px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", textAlign: "center" }}>
        Superfluid Demo (Base Sepolia)
      </h1>

      <div style={{ margin: "20px 0" }}>
        <ConnectKitButton />
      </div>

      {isConnected && (
        <>
          <input
            placeholder="Token Address (ETHx)"
            value={tokenAddress}
            disabled
            style={{ width: "100%", padding: "10px", margin: "10px 0" }}
          />

          <h2 style={{ fontSize: "20px", fontWeight: "bold" }}>
            Create Stream
          </h2>

          <input
            placeholder="Receiver Address"
            value={receiverAddress}
            onChange={handleReceiverAddressChange}
            style={{ width: "100%", padding: "10px", margin: "10px 0" }}
          />

          <input
            placeholder="Flow Rate (wei/second, minimum 385802469135)"
            value={flowRate}
            onChange={handleFlowRateChange}
            style={{ width: "100%", padding: "10px", margin: "10px 0" }}
          />

          <button
            onClick={createStream}
            style={{
              backgroundColor: "green",
              color: "white",
              padding: "10px",
              borderRadius: "5px",
              border: "none",
              cursor: "pointer",
              width: "100%",
            }}
          >
            Create Stream
          </button>
        </>
      )}

      {message && (
        <p style={{ marginTop: "20px", textAlign: "center" }}>{message}</p>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Web3Provider>
      <SuperfluidDemo />
    </Web3Provider>
  );
}
