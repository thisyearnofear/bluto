import {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useAccount, useWalletClient } from "wagmi";
import { ethers } from "ethers";
import { base } from "wagmi/chains";
import { CONTRACTS } from "@/constants/contracts";
import { CFA_FORWARDER_ABI } from "@/constants/abis/CFAForwarder";

// Constants
const BASE_SEPOLIA_RPC = "https://sepolia.base.org";
const RPC_ENDPOINTS = [
  "https://mainnet.base.org",
  "https://base.blockpi.network/v1/rpc/public",
  "https://1rpc.io/base",
  "https://base.meowrpc.com",
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getWorkingProvider = async () => {
  for (const rpc of RPC_ENDPOINTS) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(rpc);
      await provider.getBlockNumber(); // Test the connection
      return provider;
    } catch (error) {
      console.warn(`RPC ${rpc} failed, trying next one...`);
      continue;
    }
  }
  throw new Error("No working RPC endpoint found");
};

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

const FITNESS_CONTRACT = "0x45d1a7976477DC2cDD5d40e1e15f22138F20816F";

const FITNESS_ABI = [
  "function getUserScore(address _user) view returns (tuple(address user, uint256 pushups, uint256 squats, uint256 timestamp))",
  "function getTimeUntilNextSubmission(address _user) view returns (uint256)",
  "event ScoreAdded(address indexed user, uint256 pushups, uint256 squats, uint256 timestamp)",
];

interface FitnessScore {
  user: string;
  pushups: number;
  squats: number;
  timestamp: number;
}

interface Conditions {
  requiredExerciseUnits: number;
  timeframeInMinutes: number;
}

interface ConditionalStream {
  token: string;
  receiver: string;
  flowRate: string;
  tokenSymbol: string;
  lastActivity?: FitnessScore;
  stopTxHash?: string;
  isActive: boolean;
  conditions: Conditions;
}

export interface ConditionalStreamListRef {
  createConditionalStream: (
    receiver: string,
    token: string,
    flowRate: string,
    conditions: Conditions
  ) => Promise<void>;
}

export const ConditionalStreamList = forwardRef<ConditionalStreamListRef>(
  (_, ref) => {
    const { address, isConnected } = useAccount();
    const { data: walletClient } = useWalletClient();
    const [streams, setStreams] = useState<ConditionalStream[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    // Initialize Base Sepolia provider and contract
    const baseProvider = new ethers.providers.JsonRpcProvider(BASE_SEPOLIA_RPC);
    const fitnessContract = new ethers.Contract(
      FITNESS_CONTRACT,
      FITNESS_ABI,
      baseProvider
    );

    // Fetch user's fitness activity
    const fetchFitnessActivity = useCallback(async (userAddress: string) => {
      try {
        const score = await fitnessContract.getUserScore(userAddress);
        return {
          user: score.user,
          pushups: Number(score.pushups),
          squats: Number(score.squats),
          timestamp: Number(score.timestamp),
        };
      } catch (error) {
        console.error("Error fetching fitness activity:", error);
        return null;
      }
    }, []);

    // Check if user has met requirements
    const checkRequirements = useCallback(
      (score: FitnessScore | null, conditions: Conditions) => {
        if (!score) return false;

        const timeframeStart =
          Date.now() - conditions.timeframeInMinutes * 60 * 1000;
        const isWithinTimeframe = score.timestamp * 1000 > timeframeStart;
        const meetsExerciseCount =
          score.pushups + score.squats >= conditions.requiredExerciseUnits;

        return isWithinTimeframe && meetsExerciseCount;
      },
      []
    );

    // Listen for new fitness activities
    useEffect(() => {
      if (!fitnessContract) return;

      const filter = fitnessContract.filters.ScoreAdded();
      const listener = async (
        user: string,
        pushups: ethers.BigNumber,
        squats: ethers.BigNumber,
        timestamp: ethers.BigNumber
      ) => {
        if (
          streams.some((s) => s.receiver.toLowerCase() === user.toLowerCase())
        ) {
          const newScore = {
            user,
            pushups: Number(pushups),
            squats: Number(squats),
            timestamp: Number(timestamp),
          };
          setStreams((current) =>
            current.map((stream) =>
              stream.receiver.toLowerCase() === user.toLowerCase()
                ? { ...stream, lastActivity: newScore }
                : stream
            )
          );
        }
      };

      fitnessContract.on(filter, listener);
      return () => {
        fitnessContract.off(filter, listener);
      };
    }, [streams]);

    // Monitor streams and stop if requirements aren't met
    useEffect(() => {
      const checkInterval = setInterval(async () => {
        for (const stream of streams) {
          if (!stream.isActive) continue;

          const activity = await fetchFitnessActivity(stream.receiver);
          const meetsRequirements = checkRequirements(
            activity,
            stream.conditions
          );

          if (!meetsRequirements && stream.stopTxHash) {
            try {
              // Execute the pre-signed stop transaction
              const provider = new ethers.providers.JsonRpcProvider(
                BASE_SEPOLIA_RPC
              );
              await provider.sendTransaction(stream.stopTxHash);

              // Update stream status
              setStreams((current) =>
                current.map((s) =>
                  s.receiver === stream.receiver ? { ...s, isActive: false } : s
                )
              );
            } catch (error) {
              console.error("Failed to stop stream:", error);
            }
          }
        }
      }, 60000); // Check every minute

      return () => clearInterval(checkInterval);
    }, [streams, checkRequirements, fetchFitnessActivity]);

    // Create a new conditional stream
    const createConditionalStream = async (
      receiver: string,
      token: string,
      flowRate: string,
      conditions: Conditions
    ) => {
      if (!isConnected || !walletClient) {
        setMessage("Please connect your wallet first");
        return;
      }

      try {
        setLoading(true);
        const provider = new ethers.providers.Web3Provider(walletClient as any);
        const signer = provider.getSigner();

        // First check if we're on Base mainnet
        const chainId = await walletClient.getChainId();
        if (chainId !== base.id) {
          setMessage("Please switch to Base Mainnet network");
          return;
        }

        // Create stream using CFA Forwarder with retry logic
        const contract = new ethers.Contract(
          CONTRACTS.CFAForwarder,
          CFA_FORWARDER_ABI,
          signer
        );

        console.log("Creating stream with params:", {
          token,
          receiver,
          flowRate,
        });

        // Create the stream with retry logic
        const tx = await withRetry(async () => {
          const transaction = await contract.setFlowrate(
            token,
            receiver,
            flowRate,
            {
              gasLimit: 3000000,
            }
          );
          return transaction;
        });

        setMessage("Waiting for confirmation...");
        const receipt = await tx.wait(2);

        if (receipt.status === 0) {
          throw new Error(
            "Transaction failed. Check the explorer for more details."
          );
        }

        // Pre-sign a stop transaction
        const stopTx = await withRetry(() =>
          contract.populateTransaction.setFlowrate(token, receiver, 0, {
            gasLimit: 3000000,
          })
        );
        const stopTxData = await signer.signTransaction(stopTx);

        // Add to conditional streams list
        const activity = await fetchFitnessActivity(receiver);
        setStreams((current) => [
          ...current,
          {
            token,
            receiver,
            flowRate,
            tokenSymbol: token.toLowerCase().includes("ethx")
              ? "ETHx"
              : "USDCx",
            lastActivity: activity || undefined,
            stopTxHash: stopTxData,
            isActive: true,
            conditions,
          },
        ]);

        setMessage("Conditional stream created successfully!");
      } catch (error: any) {
        console.error("Error creating conditional stream:", error);
        setMessage(
          error.reason ||
            error.message ||
            "Failed to create stream. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    // Expose the createConditionalStream method via ref
    useImperativeHandle(ref, () => ({
      createConditionalStream,
    }));

    return (
      <div data-testid="conditional-stream-list" style={{ marginTop: "30px" }}>
        {loading && (
          <p style={{ textAlign: "center", color: "#666", fontSize: "14px" }}>
            Loading...
          </p>
        )}

        {message && (
          <p
            style={{
              padding: "12px",
              background: "#f5f5f5",
              borderRadius: "8px",
              marginBottom: "20px",
              textAlign: "center",
              fontSize: "14px",
              color: "#666",
            }}
          >
            {message}
          </p>
        )}

        <div>
          {streams.map((stream) => (
            <div
              key={`${stream.token}-${stream.receiver}`}
              style={{
                padding: "16px",
                marginBottom: "16px",
                border: "1px solid #eee",
                borderRadius: "8px",
                background: "white",
                textAlign: "left",
              }}
            >
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  marginBottom: "8px",
                  color: "#333",
                }}
              >
                Stream to {stream.receiver}
              </h3>

              <p
                style={{
                  fontSize: "14px",
                  color: "#666",
                  marginBottom: "8px",
                }}
              >
                Flow Rate: {stream.flowRate} {stream.tokenSymbol}/month
              </p>

              <p
                style={{
                  fontSize: "14px",
                  color: "#666",
                  marginBottom: "8px",
                }}
              >
                Requirements: {stream.conditions.requiredExerciseUnits}{" "}
                exercises every{" "}
                {stream.conditions.timeframeInMinutes === 1440
                  ? "day"
                  : stream.conditions.timeframeInMinutes === 60
                  ? "hour"
                  : `${stream.conditions.timeframeInMinutes} minutes`}
              </p>

              <p
                style={{
                  fontSize: "14px",
                  color: "#666",
                  marginBottom: "12px",
                }}
              >
                Last Activity:{" "}
                {stream.lastActivity ? (
                  <>
                    {stream.lastActivity.pushups + stream.lastActivity.squats}{" "}
                    exercises at{" "}
                    {new Date(
                      stream.lastActivity.timestamp * 1000
                    ).toLocaleString()}
                  </>
                ) : (
                  "No activity"
                )}
              </p>

              <div>
                <span
                  style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    background: stream.isActive ? "#e3f2e6" : "#ffe5e5",
                    color: stream.isActive ? "#2c682d" : "#c53030",
                  }}
                >
                  {stream.isActive ? "Active" : "Stopped"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
);
