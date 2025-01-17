import {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  ForwardedRef,
} from "react";
import { useAccount, useWalletClient } from "wagmi";
import { ethers } from "ethers";
import { base } from "wagmi/chains";
import { CONTRACTS } from "@/constants/contracts";
import { CFA_FORWARDER_ABI } from "@/constants/abis/CFAForwarder";
import { Framework } from "@superfluid-finance/sdk-core";
import { ETHx_ABI } from "@/constants/abis/ETHx";
import { ERC20_ABI } from "@/constants/abis/ERC20";

// Constants
const BASE_SEPOLIA_RPC = "https://sepolia.base.org";
const RPC_ENDPOINTS = [
  "https://mainnet.base.org",
  "https://base.blockpi.network/v1/rpc/public",
  "https://1rpc.io/base",
  "https://base.meowrpc.com",
];
const STORAGE_KEY = "conditional_streams_v1";

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

interface ActivityCheck {
  timestamp: number;
  completed: boolean;
}

interface ConditionalStream {
  id: string;
  token: string;
  receiver: string;
  flowRate: string;
  tokenSymbol: string;
  lastActivity?: FitnessScore;
  isActive: boolean;
  conditions: Conditions;
  activityHistory: ActivityCheck[];
  missedCount: number;
  isStoppingStream?: boolean;
}

export interface ConditionalStreamListRef {
  createConditionalStream: (
    receiver: string,
    token: string,
    flowRate: string,
    conditions: Conditions
  ) => Promise<void>;
}

// Add helper for time formatting
const formatTimeRemaining = (
  timeframeInMinutes: number,
  lastActivityTimestamp: number
) => {
  const timeframeMs = timeframeInMinutes * 60 * 1000;
  const timeSinceLastActivity = Date.now() - lastActivityTimestamp * 1000;
  const timeRemaining = Math.max(0, timeframeMs - timeSinceLastActivity);

  const minutes = Math.floor(timeRemaining / (1000 * 60));
  const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

  return `${minutes}m ${seconds}s`;
};

// Remove the global style injection
const styles = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

export const ConditionalStreamList = forwardRef<ConditionalStreamListRef, {}>(
  (_, ref) => {
    // Add useEffect for style injection
    useEffect(() => {
      // Only run in browser environment
      if (typeof window !== "undefined") {
        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);

        // Cleanup
        return () => {
          document.head.removeChild(styleSheet);
        };
      }
    }, []);

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
    const fetchFitnessActivity = useCallback(
      async (userAddress: string) => {
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
      },
      [fitnessContract]
    );

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
    }, [streams, fitnessContract]);

    // Load streams from localStorage on mount
    useEffect(() => {
      const savedStreams = localStorage.getItem(STORAGE_KEY);
      if (savedStreams) {
        setStreams(JSON.parse(savedStreams));
      }
    }, []);

    // Save streams to localStorage when they change
    useEffect(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(streams));
    }, [streams]);

    // Add helper to check activity history
    const updateActivityHistory = useCallback(
      (stream: ConditionalStream) => {
        const now = Date.now();
        const timeframeMs = stream.conditions.timeframeInMinutes * 60 * 1000;
        const lastCheck =
          stream.activityHistory[stream.activityHistory.length - 1]
            ?.timestamp || 0;

        // Only check if enough time has passed since last check
        if (now - lastCheck < timeframeMs) return stream;

        const completed = checkRequirements(
          stream.lastActivity || null,
          stream.conditions
        );
        const newHistory = [
          ...stream.activityHistory,
          { timestamp: now, completed },
        ];
        const missedCount = newHistory.filter((h) => !h.completed).length;

        return {
          ...stream,
          activityHistory: newHistory.slice(-5), // Keep last 5 checks
          missedCount,
        };
      },
      [checkRequirements]
    );

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

        // Initialize Superfluid Framework
        setMessage("Initializing Superfluid...");
        const sf = await Framework.create({
          chainId: base.id,
          provider: provider,
        });

        // Check token balance with retry
        const tokenContract = new ethers.Contract(token, ETHx_ABI, signer);
        const erc20Contract = new ethers.Contract(token, ERC20_ABI, signer);

        const balance = await withRetry(async () =>
          tokenContract.balanceOf(address)
        );
        console.log(
          `Token balance:`,
          ethers.utils.formatUnits(
            balance,
            token.toLowerCase().includes("usdc") ? 6 : 18
          )
        );

        // Get the superToken contract
        const superToken = await sf.loadSuperToken(token);
        const tokenSymbol = await superToken.symbol({
          providerOrSigner: provider,
        });

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
            token.toLowerCase().includes("usdc") ? 6 : 18
          )
        );

        // Calculate required allowance based on flow rate
        const requiredAllowance = ethers.utils.parseUnits(
          "1000",
          token.toLowerCase().includes("usdc") ? 6 : 18
        );
        console.log(
          "Required allowance:",
          ethers.utils.formatUnits(
            requiredAllowance,
            token.toLowerCase().includes("usdc") ? 6 : 18
          )
        );

        if (currentAllowance.lt(requiredAllowance)) {
          setMessage("Approving Superfluid host contract...");
          const approveTx = await withRetry(async () =>
            erc20Contract.approve(hostAddress, ethers.constants.MaxUint256)
          );
          await approveTx.wait(1);
          console.log("Approval confirmed");
        } else {
          console.log("Sufficient allowance already exists");
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

        // Create the stream
        setMessage("Creating stream...");
        console.log("Creating stream with params:", {
          token,
          receiver,
          flowRate,
        });

        const createFlowOperation = superToken.createFlow({
          sender: address!,
          receiver: receiver,
          flowRate: flowRate,
          overrides: {
            gasLimit: 3000000,
          },
        });

        const tx = await withRetry(async () => {
          return await createFlowOperation.exec(signer);
        });

        setMessage("Waiting for confirmation...");
        await tx.wait();

        // Add delay before verification
        await delay(5000);

        const flow = await sf.cfaV1.getFlow({
          superToken: token,
          sender: address!,
          receiver: receiver,
          providerOrSigner: provider,
        });

        if (flow.flowRate === "0") {
          throw new Error(
            "Stream was not created successfully. Flow rate is 0."
          );
        }

        // Add to conditional streams list with unique ID
        const activity = await fetchFitnessActivity(receiver);
        const streamId = `${Date.now()}-${token}-${receiver}`;
        setStreams((current) => [
          ...current,
          {
            id: streamId,
            token,
            receiver,
            flowRate,
            tokenSymbol,
            lastActivity: activity || undefined,
            isActive: true,
            conditions,
            activityHistory: [],
            missedCount: 0,
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

    // Add after other useEffects
    useEffect(() => {
      // Update activity history every minute
      const updateInterval = setInterval(() => {
        setStreams((current) =>
          current.map((stream) => {
            if (!stream.isActive) return stream;
            return updateActivityHistory(stream);
          })
        );
      }, 60000);

      return () => clearInterval(updateInterval);
    }, [updateActivityHistory]);

    // Also update when new activity is detected
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
                ? updateActivityHistory({
                    ...stream,
                    lastActivity: newScore,
                  })
                : stream
            )
          );
        }
      };

      fitnessContract.on(filter, listener);
      return () => {
        fitnessContract.off(filter, listener);
      };
    }, [streams, fitnessContract, updateActivityHistory]);

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
              key={stream.id}
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
                Flow Rate:{" "}
                {ethers.utils.formatUnits(
                  stream.flowRate,
                  stream.tokenSymbol === "USDCx" ? 6 : 18
                )}{" "}
                {stream.tokenSymbol}/month
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
                    <br />
                    Time Remaining:{" "}
                    {formatTimeRemaining(
                      stream.conditions.timeframeInMinutes,
                      stream.lastActivity.timestamp
                    )}
                  </>
                ) : (
                  "No activity"
                )}
              </p>

              <div style={{ marginTop: "16px", marginBottom: "16px" }}>
                <div
                  style={{
                    marginBottom: "8px",
                    fontSize: "14px",
                    color: "#666",
                  }}
                >
                  Activity History:
                </div>
                <div
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  {stream.activityHistory.map((check, index) => (
                    <div
                      key={check.timestamp}
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "4px",
                        background: check.completed ? "#e3f2e6" : "#ffe5e5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "20px",
                        color: check.completed ? "#2c682d" : "#c53030",
                      }}
                      title={`Check at ${new Date(
                        check.timestamp
                      ).toLocaleString()}`}
                    >
                      {check.completed ? "✓" : "✗"}
                    </div>
                  ))}
                </div>
                {stream.missedCount >= 2 && (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "8px 12px",
                      borderRadius: "4px",
                      background: "#dc3545",
                      color: "white",
                      fontSize: "14px",
                      fontWeight: "500",
                    }}
                  >
                    ⚠️ Recipient has missed {stream.missedCount} checks -
                    Consider stopping the stream
                  </div>
                )}
              </div>

              <div style={{ marginTop: "12px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
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

                  {stream.isActive &&
                    !checkRequirements(
                      stream.lastActivity || null,
                      stream.conditions
                    ) && (
                      <div
                        style={{
                          background: "#fff3cd",
                          padding: "8px 12px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          color: "#856404",
                        }}
                      >
                        Conditions not met - Stream may be stopped
                      </div>
                    )}

                  {stream.isActive && (
                    <button
                      onClick={async () => {
                        try {
                          if (!walletClient) return;

                          // Show confirmation modal
                          const confirmed = window.confirm(
                            `Are you sure you want to stop streaming ${ethers.utils.formatUnits(
                              stream.flowRate,
                              stream.tokenSymbol === "USDCx" ? 6 : 18
                            )} ${stream.tokenSymbol}/month?`
                          );

                          if (!confirmed) return;

                          // Update loading state for this specific stream
                          setStreams((current) =>
                            current.map((s) =>
                              s.id === stream.id
                                ? { ...s, isStoppingStream: true }
                                : s
                            )
                          );

                          const provider = new ethers.providers.Web3Provider(
                            walletClient as any
                          );
                          const signer = provider.getSigner();
                          const sf = await Framework.create({
                            chainId: base.id,
                            provider: provider,
                          });

                          const superToken = await sf.loadSuperToken(
                            stream.token
                          );
                          const deleteFlowOperation = superToken.deleteFlow({
                            sender: address!,
                            receiver: stream.receiver,
                          });

                          const tx = await deleteFlowOperation.exec(signer);
                          await tx.wait();

                          setStreams((current) =>
                            current.map((s) =>
                              s.id === stream.id
                                ? {
                                    ...s,
                                    isActive: false,
                                    isStoppingStream: false,
                                  }
                                : s
                            )
                          );
                        } catch (error) {
                          console.error("Failed to stop stream:", error);
                          // Reset loading state on error
                          setStreams((current) =>
                            current.map((s) =>
                              s.id === stream.id
                                ? { ...s, isStoppingStream: false }
                                : s
                            )
                          );
                        }
                      }}
                      disabled={stream.isStoppingStream}
                      style={{
                        padding: "4px 12px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        background: stream.isStoppingStream
                          ? "#dc354580"
                          : "#dc3545",
                        color: "white",
                        border: "none",
                        cursor: stream.isStoppingStream
                          ? "not-allowed"
                          : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      {stream.isStoppingStream ? (
                        <>
                          <div
                            style={{
                              width: "12px",
                              height: "12px",
                              border: "2px solid white",
                              borderTopColor: "transparent",
                              borderRadius: "50%",
                              animation: "spin 1s linear infinite",
                            }}
                          />
                          Stopping...
                        </>
                      ) : (
                        "Stop Stream"
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
);
