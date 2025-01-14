"use client";

import { useState, ChangeEvent } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { ethers } from "ethers";
import { CONTRACTS, MINIMUM_FLOW_RATE } from "@/constants/contracts";
import { CFA_FORWARDER_ABI } from "@/constants/abis/CFAForwarder";
import { ETHx_ABI } from "@/constants/abis/ETHx";
import { FlowRateInput } from "./FlowRateInput";
import { ReceiverSearch } from "./ReceiverSearch";

export function StreamForm() {
  const { address, isConnected } = useAccount();
  const [receiverAddress, setReceiverAddress] = useState<string>("");
  const [flowRate, setFlowRate] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");
  const { data: walletClient } = useWalletClient();

  const handleReceiverAddressChange = (e: ChangeEvent<HTMLInputElement>) =>
    setReceiverAddress(e.target.value);

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

    // Add validation
    if (!ethers.utils.isAddress(receiverAddress)) {
      setMessage("Please enter a valid receiver address");
      return;
    }

    if (!flowRate || isNaN(Number(flowRate))) {
      setMessage("Please select a valid flow rate");
      return;
    }

    try {
      setMessage("Checking approval...");
      const provider = new ethers.providers.Web3Provider(walletClient as any);
      const signer = provider.getSigner();

      // Check ETHx balance
      const ethxContract = new ethers.Contract(
        CONTRACTS.ETHx,
        ETHx_ABI,
        signer
      );
      const balance = await ethxContract.balanceOf(address);
      console.log("ETHx balance:", ethers.utils.formatEther(balance));

      // Create the stream
      const contract = new ethers.Contract(
        CONTRACTS.CFAForwarder,
        CFA_FORWARDER_ABI,
        signer
      );

      setMessage("Creating stream...");
      console.log("Creating stream with params:", {
        token: CONTRACTS.ETHx,
        receiver: receiverAddress,
        flowRate: flowRate,
      });

      const tx = await contract.setFlowrate(
        CONTRACTS.ETHx,
        receiverAddress,
        flowRate,
        {
          gasLimit: 3000000,
        }
      );

      console.log("Stream creation tx sent:", tx.hash);
      setTxHash(tx.hash);

      setMessage("Waiting for confirmation...");
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

  const getStreamLinks = () => {
    if (!address) return null;

    return (
      <div style={{ marginTop: "20px", textAlign: "center" }}>
        <a
          href={`https://explorer.superfluid.finance/base-sepolia/accounts/${address}?tab=streams`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "blue",
            textDecoration: "underline",
            marginRight: "20px",
          }}
        >
          View My Streams
        </a>
        {txHash && (
          <a
            href={`https://sepolia.basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "blue", textDecoration: "underline" }}
          >
            View Transaction
          </a>
        )}
      </div>
    );
  };

  if (!isConnected) return null;

  return (
    <div className="stream-form">
      <input
        placeholder="Token Address (ETHx)"
        value={CONTRACTS.ETHx}
        disabled
        style={{ width: "100%", padding: "10px", margin: "10px 0" }}
      />

      <h2 style={{ fontSize: "20px", fontWeight: "bold" }}>Create Stream</h2>

      <ReceiverSearch onSelect={setReceiverAddress} />

      <div style={{ margin: "20px 0" }}>
        <FlowRateInput onChange={setFlowRate} />
      </div>

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

      {message && (
        <p style={{ marginTop: "20px", textAlign: "center" }}>{message}</p>
      )}

      {getStreamLinks()}
    </div>
  );
}
