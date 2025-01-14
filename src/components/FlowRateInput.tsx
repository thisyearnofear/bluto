"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";

interface FlowRateInputProps {
  onChange: (flowRate: string) => void;
}

export function FlowRateInput({ onChange }: FlowRateInputProps) {
  const [amountPerMonth, setAmountPerMonth] = useState<number>(0.01);

  // Convert tokens per month to wei per second
  useEffect(() => {
    // 1 month = 30 days = 2592000 seconds
    const tokensPerSecond = amountPerMonth / 2592000;
    // Convert to wei per second (18 decimals)
    const weiPerSecond = ethers.utils.parseEther(tokensPerSecond.toFixed(18));
    onChange(weiPerSecond.toString());
  }, [amountPerMonth, onChange]);

  return (
    <div className="flow-rate-container">
      <label>Stream Amount: {amountPerMonth.toFixed(3)} ETHx per month</label>
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
        <span>0.01 ETHx/month</span>
        <span>1 ETHx/month</span>
      </div>
    </div>
  );
}
