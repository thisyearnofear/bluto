"use client";

import { useState, ChangeEvent, useEffect } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { ethers } from "ethers";
import { base } from "wagmi/chains";
import { CONTRACTS } from "@/constants/contracts";
import { CFA_FORWARDER_ABI } from "@/constants/abis/CFAForwarder";
import { ETHx_ABI } from "@/constants/abis/ETHx";
import { FlowRateInput } from "./FlowRateInput";
import { ReceiverSearch } from "./ReceiverSearch";
import { TokenFlow } from "./TokenFlow";

export function StreamForm() {
  const { address, isConnected } = useAccount();
  const [receiverAddress, setReceiverAddress] = useState<string>("");
  const [flowRate, setFlowRate] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");
  const { data: walletClient } = useWalletClient();
  const [copied, setCopied] = useState(false);
  const [chainError, setChainError] = useState(false);
  const [selectedToken, setSelectedToken] = useState<"ETH" | "USDC">("ETH");
  const [balance, setBalance] = useState<string>("0");

  const handleReceiverAddressChange = (e: ChangeEvent<HTMLInputElement>) =>
    setReceiverAddress(e.target.value);

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(CONTRACTS.ETHx);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const createStream = async () => {
    if (!isConnected || !walletClient) {
      setMessage("Please connect your wallet first.");
      return;
    }

    // Check if we're on Base Mainnet
    const chainId = await walletClient.getChainId();
    if (chainId !== base.id) {
      setMessage("Please switch to Base Mainnet network");
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

      // Check token balance
      const tokenAddress =
        selectedToken === "ETH" ? CONTRACTS.ETHx : CONTRACTS.USDCx;
      const tokenContract = new ethers.Contract(tokenAddress, ETHx_ABI, signer);
      const balance = await tokenContract.balanceOf(address);
      console.log(
        `${selectedToken}x balance:`,
        ethers.utils.formatUnits(balance, selectedToken === "USDC" ? 6 : 18)
      );

      // Create the stream
      const contract = new ethers.Contract(
        CONTRACTS.CFAForwarder,
        CFA_FORWARDER_ABI,
        signer
      );

      setMessage("Creating stream...");
      console.log("Creating stream with params:", {
        token: tokenAddress,
        receiver: receiverAddress,
        flowRate: flowRate,
      });

      const tx = await contract.setFlowrate(
        tokenAddress,
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
          href={`https://explorer.superfluid.finance/base/accounts/${address}?tab=streams`}
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
            href={`https://basescan.org/tx/${txHash}`}
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

  useEffect(() => {
    if (isConnected && walletClient) {
      const checkChain = async () => {
        const chainId = await walletClient.getChainId();
        setChainError(chainId !== base.id);
      };
      checkChain();
    }
  }, [isConnected, walletClient]);

  useEffect(() => {
    if (isConnected && walletClient && address) {
      const checkBalance = async () => {
        try {
          const provider = new ethers.providers.Web3Provider(
            walletClient as any
          );
          const tokenContract = new ethers.Contract(
            selectedToken === "ETH" ? CONTRACTS.ETHx : CONTRACTS.USDCx,
            ETHx_ABI,
            provider
          );

          // Use realtimeBalanceOf instead of balanceOf for Super Tokens
          const [availableBalance] = await tokenContract.realtimeBalanceOf(
            address
          );
          setBalance(
            ethers.utils.formatUnits(
              availableBalance.toString(),
              selectedToken === "USDC" ? 6 : 18
            )
          );
        } catch (error) {
          console.error("Error checking balance:", error);
          setBalance("0");
        }
      };
      checkBalance();
    }
  }, [isConnected, walletClient, address, selectedToken]);

  if (!isConnected) return null;

  return (
    <div className="stream-form" style={{ padding: "0 10px" }}>
      {chainError && (
        <p style={{ color: "red", marginBottom: "20px" }}>
          Please switch to Base Mainnet network
        </p>
      )}

      <TokenFlow
        selectedToken={selectedToken}
        setSelectedToken={setSelectedToken}
        balance={balance}
      />

      <h2
        style={{
          fontSize: "20px",
          fontWeight: "bold",
          marginTop: "30px",
          marginBottom: "20px",
        }}
      >
        Create Stream
      </h2>

      <ReceiverSearch onSelect={setReceiverAddress} />

      <div style={{ margin: "20px 0" }}>
        <FlowRateInput onChange={setFlowRate} selectedToken={selectedToken} />
      </div>

      <button
        onClick={createStream}
        style={{
          backgroundColor: "#4CAF50",
          color: "white",
          padding: "clamp(8px, 2vh, 12px)",
          borderRadius: "5px",
          border: "none",
          cursor: "pointer",
          width: "100%",
          fontSize: "clamp(14px, 4vw, 16px)",
          opacity: !isConnected || chainError ? 0.5 : 1,
        }}
        disabled={!isConnected || chainError}
      >
        Create Stream
      </button>

      {message && (
        <p
          style={{
            marginTop: "20px",
            textAlign: "center",
            padding: "10px",
            background: "#f5f5f5",
            borderRadius: "4px",
          }}
        >
          {message}
        </p>
      )}

      {getStreamLinks()}
    </div>
  );
}
