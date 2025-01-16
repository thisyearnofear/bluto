"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";

interface FlowRateInputProps {
  onChange: (flowRate: string) => void;
  selectedToken: "ETH" | "USDC";
}

export function FlowRateInput({ onChange, selectedToken }: FlowRateInputProps) {
  const [amountPerMonth, setAmountPerMonth] = useState<number>(0.01);

  // Convert tokens per month to wei per second
  useEffect(() => {
    // 1 month = 30 days = 2592000 seconds
    const tokensPerSecond = amountPerMonth / 2592000;
    // Convert to wei per second (18 decimals for ETH, 6 for USDC)
    const decimals = selectedToken === "USDC" ? 6 : 18;
    const weiPerSecond = ethers.utils.parseUnits(
      tokensPerSecond.toFixed(decimals),
      decimals
    );
    onChange(weiPerSecond.toString());
  }, [amountPerMonth, onChange, selectedToken]);

  return (
    <div className="flow-rate-container">
      <label>
        Stream Amount: {amountPerMonth.toFixed(3)} {selectedToken}x per month
      </label>
      <input
        type="range"
        min={0.01}
        max={1}
        step={0.01}
        value={amountPerMonth}
        onChange={(e) => setAmountPerMonth(Number(e.target.value))}
        style={{ width: "100%", margin: "10px 0" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>0.01 {selectedToken}x/month</span>
        <span>1 {selectedToken}x/month</span>
      </div>
    </div>
  );
}
