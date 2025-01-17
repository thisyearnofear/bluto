"use client";

import { useState, ChangeEvent, useEffect } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { ethers } from "ethers";
import { base } from "wagmi/chains";
import { Framework } from "@superfluid-finance/sdk-core";
import { CONTRACTS } from "@/constants/contracts";
import { CFA_FORWARDER_ABI } from "@/constants/abis/CFAForwarder";
import { ETHx_ABI } from "@/constants/abis/ETHx";
import { ERC20_ABI } from "@/constants/abis/ERC20";
import { FlowRateInput } from "./FlowRateInput";
import { ReceiverSearch } from "./ReceiverSearch";
import { TokenFlow } from "./TokenFlow";

const RPC_ENDPOINTS = [
  "https://base-mainnet.g.alchemy.com/v2/Tx9luktS3qyIwEKVtjnQrpq8t3MNEV-B",
  "https://base.rpc.thirdweb.com/b9a142d988a6e40baa7342b423bf2361",
  "https://base.blockpi.network/v1/rpc/public",
  "https://1rpc.io/base",
  "https://base.meowrpc.com",
  "https://mainnet.base.org",
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async <T,>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 1000
): Promise<T> => {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      if (
        error?.message?.includes("429") ||
        error?.error?.message?.includes("429")
      ) {
        console.log(
          `Rate limit hit, attempt ${attempt}/${maxAttempts}, waiting ${delayMs}ms...`
        );
        await delay(delayMs);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

let currentRpcIndex = 0;

const getWorkingProvider = async (walletClient: any) => {
  const startIndex = currentRpcIndex;

  do {
    const rpc = RPC_ENDPOINTS[currentRpcIndex];
    try {
      const provider = new ethers.providers.JsonRpcProvider(rpc);
      await provider.getBlockNumber(); // Test the connection
      console.log(`Using RPC endpoint: ${rpc}`);

      // Override the provider's send method to use our RPC
      const customProvider = new ethers.providers.Web3Provider(walletClient);
      const originalSend = customProvider.send.bind(customProvider);
      customProvider.send = async (method, params) => {
        try {
          return await originalSend(method, params);
        } catch (error: any) {
          if (error?.message?.includes("429")) {
            console.log("Rate limit hit, cycling to next RPC...");
            // Move to next RPC
            currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
            const nextProvider = new ethers.providers.JsonRpcProvider(
              RPC_ENDPOINTS[currentRpcIndex]
            );
            console.log(
              `Switched to RPC endpoint: ${RPC_ENDPOINTS[currentRpcIndex]}`
            );
            return await nextProvider.send(method, params);
          }
          throw error;
        }
      };

      return customProvider;
    } catch (error) {
      console.warn(`RPC ${rpc} failed, trying next one...`);
      currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
      // If we've tried all RPCs, throw error
      if (currentRpcIndex === startIndex) {
        throw new Error("All RPC endpoints failed");
      }
    }
  } while (true);
};

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

    // Add validation for recipient address
    if (!receiverAddress || !ethers.utils.isAddress(receiverAddress)) {
      setMessage("Please enter a valid recipient address");
      return;
    }

    // Add validation to prevent self-streaming
    if (receiverAddress.toLowerCase() === address?.toLowerCase()) {
      setMessage("You cannot create a stream to yourself");
      return;
    }

    try {
      // Check if we're on Base mainnet
      const chainId = await walletClient.getChainId();
      if (chainId !== base.id) {
        setMessage("Please switch to Base Mainnet network");
        return;
      }

      setMessage("Initializing Superfluid...");
      const provider = await getWorkingProvider(walletClient);
      const signer = provider.getSigner();

      // Initialize Superfluid Framework
      const sf = await Framework.create({
        chainId: base.id,
        provider: provider,
      });

      // Check token balance with retry
      const tokenAddress =
        selectedToken === "ETH" ? CONTRACTS.ETHx : CONTRACTS.USDCx;
      const tokenContract = new ethers.Contract(tokenAddress, ETHx_ABI, signer);
      const erc20Contract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        signer
      );

      const balance = await withRetry(async () =>
        tokenContract.balanceOf(address)
      );
      console.log(
        `${selectedToken}x balance:`,
        ethers.utils.formatUnits(balance, selectedToken === "USDC" ? 6 : 18)
      );

      // Get the superToken contract
      const superToken = await sf.loadSuperToken(tokenAddress);

      // Check and handle approvals
      setMessage("Checking approvals...");
      const hostAddress = await sf.settings.config.hostAddress;

      // First check if we have enough allowance
      const currentAllowance = await erc20Contract.allowance(
        address!,
        hostAddress
      );
      console.log(
        "Current allowance:",
        ethers.utils.formatUnits(
          currentAllowance,
          selectedToken === "USDC" ? 6 : 18
        )
      );

      if (
        currentAllowance.lt(
          ethers.utils.parseUnits("1000", selectedToken === "USDC" ? 6 : 18)
        )
      ) {
        setMessage("Approving Superfluid host contract...");
        const approveTx = await withRetry(async () =>
          erc20Contract.approve(hostAddress, ethers.constants.MaxUint256)
        );
        await approveTx.wait(1);
        console.log("Approval confirmed");
      }

      // Now authorize the flow
      setMessage("Authorizing flow...");
      const authorizeOperation =
        superToken.authorizeFlowOperatorWithFullControl({
          flowOperator: hostAddress,
        });

      const authTx = await withRetry(async () => {
        return await authorizeOperation.exec(signer);
      });
      await authTx.wait(1);
      console.log("Flow authorization confirmed");

      // Create the stream using Superfluid SDK
      setMessage("Creating stream...");
      console.log("Creating stream with params:", {
        token: tokenAddress,
        receiver: receiverAddress,
        flowRate: flowRate,
      });

      try {
        // Create stream using Superfluid SDK
        const createFlowOperation = superToken.createFlow({
          sender: address!,
          receiver: receiverAddress,
          flowRate: flowRate,
        });

        const tx = await withRetry(async () => {
          return await createFlowOperation.exec(signer);
        });

        console.log("Stream creation tx sent:", tx.hash);
        setTxHash(tx.hash);

        setMessage("Waiting for confirmation...");
        await tx.wait();

        // Add delay before verification
        await delay(5000); // Wait 5 seconds for indexing

        // Verify the stream was created using the SDK
        const flow = await sf.cfaV1.getFlow({
          superToken: tokenAddress,
          sender: address!,
          receiver: receiverAddress,
          providerOrSigner: provider,
        });

        console.log("New flow info:", {
          flowRate: flow.flowRate,
          deposit: flow.deposit,
          timestamp: flow.timestamp,
        });

        if (flow.flowRate === "0") {
          throw new Error(
            "Stream was not created successfully. Flow rate is 0."
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

        // More descriptive error messages
        if (error.message?.includes("gas")) {
          setMessage(
            "Transaction failed: Gas estimation error. You may need to approve Superfluid first."
          );
        } else if (error.message?.includes("insufficient")) {
          setMessage(
            "Insufficient balance. Make sure you have enough ETHx and ETH for gas."
          );
        } else {
          setMessage(
            error.reason ||
              error.message ||
              "Failed to create stream. Please try again."
          );
        }
      }
    } catch (error: any) {
      console.error("Detailed error:", {
        error,
        message: error.message,
        reason: error.reason,
        code: error.code,
        data: error.data,
        chainId: await walletClient.getChainId(),
      });

      // More descriptive error messages
      if (error.message?.includes("gas")) {
        setMessage(
          "Transaction failed: Gas estimation error. You may need to approve Superfluid first."
        );
      } else if (error.message?.includes("insufficient")) {
        setMessage(
          "Insufficient balance. Make sure you have enough ETHx and ETH for gas."
        );
      } else {
        setMessage(
          error.reason ||
            error.message ||
            "Failed to create stream. Please try again."
        );
      }
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

          // Use balanceOf instead of realtimeBalanceOf
          const balance = await tokenContract.balanceOf(address);
          console.log("Raw balance:", balance.toString());
          const formattedBalance = ethers.utils.formatUnits(
            balance,
            selectedToken === "USDC" ? 6 : 18
          );
          console.log("Formatted balance:", formattedBalance);
          setBalance(formattedBalance);
        } catch (error) {
          console.error("Error checking balance:", error);
          setBalance("0");
        }
      };
      checkBalance();
    } else {
      setBalance("0");
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
