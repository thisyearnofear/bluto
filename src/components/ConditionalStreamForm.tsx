import { useState } from "react";
import { useAccount } from "wagmi";
import { ethers } from "ethers";
import { FlowRateInput } from "./FlowRateInput";
import { ReceiverSearch } from "./ReceiverSearch";
import { TokenFlow } from "./TokenFlow";
import { CONTRACTS } from "@/constants/contracts";

interface ConditionalStreamFormProps {
  onSubmit: (
    receiver: string,
    token: string,
    flowRate: string,
    conditions: {
      requiredExerciseUnits: number;
      timeframeInMinutes: number;
    }
  ) => Promise<void>;
}

export function ConditionalStreamForm({
  onSubmit,
}: ConditionalStreamFormProps) {
  const { isConnected } = useAccount();
  const [receiver, setReceiver] = useState("");
  const [flowRate, setFlowRate] = useState("");
  const [selectedToken, setSelectedToken] = useState<"ETH" | "USDC">("ETH");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exerciseUnits, setExerciseUnits] = useState("50");
  const [timeframe, setTimeframe] = useState("1440"); // 24 hours in minutes
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!receiver || !flowRate || !exerciseUnits || !timeframe) {
      setError("Please fill in all fields");
      return;
    }

    try {
      setIsSubmitting(true);

      // Use the same token addresses as the main stream form
      const tokenAddress =
        selectedToken === "ETH" ? CONTRACTS.ETHx : CONTRACTS.USDCx;

      await onSubmit(receiver, tokenAddress, flowRate, {
        requiredExerciseUnits: Number(exerciseUnits),
        timeframeInMinutes: Number(timeframe),
      });
    } catch (error) {
      console.error("Form submission error:", error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Failed to create stream");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const timeframeOptions = [
    { value: "10", label: "10 minutes" },
    { value: "60", label: "1 hour" },
    { value: "360", label: "6 hours" },
    { value: "720", label: "12 hours" },
    { value: "1440", label: "24 hours" },
  ];

  if (!isConnected) return null;

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: "30px" }}>
      <div style={{ marginBottom: "20px" }}>
        <TokenFlow
          selectedToken={selectedToken}
          setSelectedToken={setSelectedToken}
          balance="0"
        />
      </div>

      <div style={{ marginBottom: "20px" }}>
        <ReceiverSearch
          onSelect={(address) => {
            setError("");
            setReceiver(address);
          }}
        />
      </div>

      <div style={{ marginBottom: "20px" }}>
        <FlowRateInput
          onChange={(value) => {
            setError("");
            setFlowRate(value);
          }}
          selectedToken={selectedToken}
        />
      </div>

      <div
        style={{
          marginBottom: "20px",
          textAlign: "left",
        }}
      >
        <label
          style={{
            display: "block",
            fontSize: "14px",
            color: "#666",
            marginBottom: "8px",
          }}
        >
          Exercise Requirements
        </label>
        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <input
            type="number"
            value={exerciseUnits}
            onChange={(e) => {
              setError("");
              setExerciseUnits(e.target.value);
            }}
            min="1"
            style={{
              padding: "8px 12px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              width: "80px",
              fontSize: "14px",
            }}
          />
          <span style={{ color: "#666", fontSize: "14px" }}>
            exercises every
          </span>
          <select
            value={timeframe}
            onChange={(e) => {
              setError("");
              setTimeframe(e.target.value);
            }}
            style={{
              padding: "8px 12px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "14px",
              color: "#666",
              background: "white",
            }}
          >
            {timeframeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#ffe5e5",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "20px",
            fontSize: "14px",
            color: "#c53030",
            textAlign: "left",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          background: "#fff9db",
          padding: "12px",
          borderRadius: "8px",
          marginBottom: "20px",
          fontSize: "14px",
          color: "#805b10",
          textAlign: "left",
        }}
      >
        This stream requires {exerciseUnits} exercises (pushups + squats) every{" "}
        {timeframeOptions.find((o) => o.value === timeframe)?.label}. The stream
        will stop if requirements aren't met.
      </div>

      <button
        type="submit"
        disabled={!receiver || !flowRate || isSubmitting}
        style={{
          backgroundColor:
            !receiver || !flowRate || isSubmitting ? "#ccc" : "#4CAF50",
          color: "white",
          padding: "clamp(8px, 2vh, 12px)",
          borderRadius: "5px",
          border: "none",
          cursor:
            !receiver || !flowRate || isSubmitting ? "not-allowed" : "pointer",
          width: "100%",
          fontSize: "clamp(14px, 4vw, 16px)",
        }}
      >
        {isSubmitting ? "Creating Stream..." : "Create Conditional Stream"}
      </button>
    </form>
  );
}
