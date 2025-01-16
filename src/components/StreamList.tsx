import { useState, useEffect, useCallback } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { ethers } from "ethers";
import { Framework } from "@superfluid-finance/sdk-core";
import { CONTRACTS } from "@/constants/contracts";
import { CFA_FORWARDER_ABI } from "@/constants/abis/CFAForwarder";

interface Stream {
  token: string;
  receiver: string;
  receiverEns?: string;
  receiverAvatar?: string;
  flowRate: string;
  tokenSymbol: string;
  totalAmountStreamed?: string;
  streamedSince?: string;
  isResolvingEns?: boolean;
}

const SUBGRAPH_URL =
  "https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1";

// Cache for ENS resolutions
const ensCache: Record<
  string,
  { displayName?: string; avatar?: string; timestamp: number }
> = {};
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

async function fetchStreams(address: string): Promise<any[]> {
  const query = `
    query GetAllStreams($address: String!) {
      streams(
        where: {
          sender: $address,
          currentFlowRate_gt: "0"
        }
        orderBy: createdAtTimestamp
        orderDirection: desc
        first: 100
      ) {
        token {
          id
          symbol
          name
        }
        receiver {
          id
        }
        currentFlowRate
        streamedUntilUpdatedAt
        createdAtTimestamp
        updatedAtTimestamp
        flowUpdatedEvents(
          orderBy: timestamp
          orderDirection: desc
          first: 1
        ) {
          flowRate
          timestamp
        }
      }
    }
  `;

  const response = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { address: address.toLowerCase() },
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch streams from subgraph");
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(data.errors[0].message);
  }

  return data.data.streams || [];
}

async function resolveAddress(
  address: string
): Promise<{ displayName: string | undefined; avatar: string | undefined }> {
  const now = Date.now();

  // Check cache first
  if (ensCache[address] && now - ensCache[address].timestamp < CACHE_DURATION) {
    return {
      displayName: ensCache[address].displayName,
      avatar: ensCache[address].avatar,
    };
  }

  try {
    const response = await fetch(`https://api.web3.bio/ns/${address}`);
    if (!response.ok) {
      ensCache[address] = { timestamp: now };
      return { displayName: undefined, avatar: undefined };
    }

    const data = await response.json();
    const result = {
      displayName: data?.[0]?.displayName || undefined,
      avatar: data?.[0]?.avatar || undefined,
    };

    // Cache the result
    ensCache[address] = {
      ...result,
      timestamp: now,
    };

    return result;
  } catch (error) {
    console.error("Error resolving address:", error);
    ensCache[address] = { timestamp: now };
    return { displayName: undefined, avatar: undefined };
  }
}

export function StreamList() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [message, setMessage] = useState<string>("");
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamToStop, setStreamToStop] = useState<Stream | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stoppingStream, setStoppingStream] = useState<string | null>(null);

  const fetchStreamData = useCallback(async () => {
    if (!isConnected || !address) return;

    try {
      setLoading(true);
      const streams = await fetchStreams(address);

      const activeStreams: Stream[] = [];

      for (const stream of streams) {
        // Add stream with initial loading state for ENS
        const streamObj: Stream = {
          token: stream.token.id,
          receiver: stream.receiver.id,
          flowRate: stream.currentFlowRate,
          tokenSymbol: stream.token.symbol,
          isResolvingEns: true,
        };

        activeStreams.push(streamObj);
        setStreams([...activeStreams]);

        // Resolve ENS asynchronously
        const { displayName, avatar } = await resolveAddress(
          stream.receiver.id
        );

        // Update stream with resolved ENS
        streamObj.receiverEns = displayName;
        streamObj.receiverAvatar = avatar;
        streamObj.isResolvingEns = false;

        const startTime = parseInt(stream.createdAtTimestamp) * 1000;
        const lastUpdateTime = parseInt(stream.updatedAtTimestamp) * 1000;
        const currentTime = Date.now();

        const streamedSinceUpdate = ethers.BigNumber.from(
          stream.currentFlowRate
        ).mul(Math.floor((currentTime - lastUpdateTime) / 1000));

        streamObj.totalAmountStreamed = ethers.utils.formatEther(
          ethers.BigNumber.from(stream.streamedUntilUpdatedAt).add(
            streamedSinceUpdate
          )
        );
        streamObj.streamedSince = new Date(startTime).toISOString();

        setStreams([...activeStreams]);
      }

      setMessage("");
    } catch (err) {
      console.error("Error fetching streams:", err);
      setMessage("Failed to fetch streams. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isConnected, address]);

  // Initial fetch on mount
  useEffect(() => {
    fetchStreamData();
  }, [fetchStreamData]);

  // Manual refresh handler
  const handleRefresh = () => {
    setRefreshing(true);
    fetchStreamData();
  };

  const stopStream = async (stream: Stream) => {
    if (!isConnected || !walletClient) {
      setMessage("Please connect your wallet first.");
      return;
    }

    try {
      setStoppingStream(`${stream.token}-${stream.receiver}`);
      setMessage(`Stopping ${stream.tokenSymbol} stream...`);

      const provider = new ethers.providers.Web3Provider(walletClient as any);
      const signer = provider.getSigner();

      const contract = new ethers.Contract(
        CONTRACTS.CFAForwarder,
        CFA_FORWARDER_ABI,
        signer
      );

      const tx = await contract.setFlowrate(stream.token, stream.receiver, 0, {
        gasLimit: 3000000,
      });

      setMessage("Waiting for confirmation...");
      const receipt = await tx.wait(2);

      if (receipt.status === 0) {
        throw new Error(
          "Transaction failed. Check the explorer for more details."
        );
      }

      setStreams(
        streams.filter(
          (s) => s.token !== stream.token || s.receiver !== stream.receiver
        )
      );

      setMessage(`${stream.tokenSymbol} stream has been stopped successfully!`);
    } catch (error: any) {
      console.error("Error stopping stream:", error);
      setMessage(
        error.reason ||
          error.message ||
          "Failed to stop stream. Please try again."
      );
    } finally {
      setStoppingStream(null);
      setStreamToStop(null);
    }
  };

  // Add error handling for balance check errors
  useEffect(() => {
    // Ignore specific RPC errors that don't affect functionality
    const originalError = console.error;
    console.error = (...args) => {
      const errorMessage = args.join(" ");
      if (
        errorMessage.includes("missing revert data") ||
        errorMessage.includes("Internal JSON-RPC error") ||
        errorMessage.includes("pelagus_healthCheck")
      ) {
        // Ignore these specific errors
        return;
      }
      originalError.apply(console, args);
    };

    return () => {
      console.error = originalError;
    };
  }, []);

  if (!isConnected) return null;

  const formatFlowRate = (flowRate: string) => {
    // Convert wei/sec to tokens/month
    const tokensPerSecond = ethers.utils.formatEther(flowRate);
    const tokensPerMonth = parseFloat(tokensPerSecond) * 2592000; // 30 days in seconds
    return tokensPerMonth.toFixed(6);
  };

  return (
    <div style={{ marginTop: "40px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h2
          style={{
            fontSize: "20px",
            fontWeight: "bold",
            margin: 0,
          }}
        >
          My Active Streams
        </h2>
        <button
          onClick={handleRefresh}
          disabled={loading || refreshing}
          style={{
            padding: "8px 16px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: loading || refreshing ? "not-allowed" : "pointer",
            opacity: loading || refreshing ? 0.7 : 1,
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
          {refreshing && (
            <span
              style={{
                display: "inline-block",
                animation: "spin 1s linear infinite",
              }}
            >
              ↻
            </span>
          )}
        </button>
      </div>

      {loading && !refreshing ? (
        <p>Loading streams...</p>
      ) : streams.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {streams.map((stream, index) => (
            <div
              key={`${stream.token}-${stream.receiver}-${index}`}
              style={{
                padding: "15px",
                backgroundColor: "#f5f5f5",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: "bold" }}>
                  {formatFlowRate(stream.flowRate)} {stream.tokenSymbol}/month
                </div>
                <div
                  style={{
                    fontSize: "14px",
                    color: "#666",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  To:
                  {stream.isResolvingEns ? (
                    <span style={{ fontSize: "12px", color: "#999" }}>
                      Resolving name...
                    </span>
                  ) : (
                    <>
                      {stream.receiverAvatar && (
                        <img
                          src={stream.receiverAvatar}
                          alt=""
                          style={{
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            marginRight: "4px",
                          }}
                        />
                      )}
                      <a
                        href={`https://explorer.superfluid.finance/base/accounts/${stream.receiver}?tab=streams`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#4CAF50", textDecoration: "none" }}
                      >
                        {stream.receiverEns || stream.receiver}
                      </a>
                    </>
                  )}
                </div>
                {stream.totalAmountStreamed && (
                  <div
                    style={{
                      fontSize: "14px",
                      color: "#666",
                      marginTop: "4px",
                    }}
                  >
                    Total Streamed:{" "}
                    {parseFloat(stream.totalAmountStreamed).toFixed(6)}{" "}
                    {stream.tokenSymbol}
                  </div>
                )}
                {stream.streamedSince && (
                  <div style={{ fontSize: "14px", color: "#666" }}>
                    Since: {new Date(stream.streamedSince).toLocaleDateString()}
                  </div>
                )}
              </div>
              <button
                onClick={() => setStreamToStop(stream)}
                disabled={
                  stoppingStream === `${stream.token}-${stream.receiver}`
                }
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#ff4444",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor:
                    stoppingStream === `${stream.token}-${stream.receiver}`
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    stoppingStream === `${stream.token}-${stream.receiver}`
                      ? 0.7
                      : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {stoppingStream === `${stream.token}-${stream.receiver}` ? (
                  <>
                    Stopping...
                    <span
                      style={{
                        display: "inline-block",
                        animation: "spin 1s linear infinite",
                      }}
                    >
                      ↻
                    </span>
                  </>
                ) : (
                  "Stop Stream"
                )}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: "#666" }}>No active streams found.</p>
      )}

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

      {/* Confirmation Dialog */}
      {streamToStop && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "8px",
              maxWidth: "400px",
              width: "90%",
            }}
          >
            <h3 style={{ marginBottom: "15px" }}>Confirm Stream Stop</h3>
            <p style={{ marginBottom: "20px" }}>
              Are you sure you want to stop streaming{" "}
              {formatFlowRate(streamToStop.flowRate)} {streamToStop.tokenSymbol}
              /month?
            </p>
            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setStreamToStop(null)}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#f5f5f5",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => stopStream(streamToStop)}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#ff4444",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Stop Stream
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
