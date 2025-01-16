"use client";

import { useState } from "react";
import { CONTRACTS } from "@/constants/contracts";

interface TokenFlowProps {
  selectedToken: "ETH" | "USDC";
  setSelectedToken: (token: "ETH" | "USDC") => void;
  balance: string;
}

export function TokenFlow({
  selectedToken,
  setSelectedToken,
  balance,
}: TokenFlowProps) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        <button
          onClick={() => setSelectedToken("ETH")}
          style={{
            padding: "10px 20px",
            background: selectedToken === "ETH" ? "#4CAF50" : "#f5f5f5",
            color: selectedToken === "ETH" ? "white" : "black",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          ETH → ETHx
        </button>
        <button
          onClick={() => setSelectedToken("USDC")}
          style={{
            padding: "10px 20px",
            background: selectedToken === "USDC" ? "#4CAF50" : "#f5f5f5",
            color: selectedToken === "USDC" ? "white" : "black",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          USDC → USDCx
        </button>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "20px",
          padding: "20px",
          background: "#f9f9f9",
          borderRadius: "8px",
          margin: "0 auto",
          maxWidth: "300px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "24px" }}>{selectedToken}</div>
          <div style={{ fontSize: "12px", color: "#666" }}>Regular Token</div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div style={{ color: "#666" }}>→</div>
          <div
            style={{
              fontSize: "10px",
              color: "#666",
              maxWidth: "80px",
              textAlign: "center",
            }}
          >
            Wrap for streaming
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "24px" }}>{selectedToken}x</div>
          <div style={{ fontSize: "12px", color: "#666" }}>Super Token</div>
        </div>
      </div>

      <div
        style={{
          fontSize: "14px",
          color: "#666",
          textAlign: "center",
          marginTop: "10px",
        }}
      >
        Balance: {Number(balance).toFixed(6)} {selectedToken}x
      </div>

      <a
        href={`https://app.superfluid.finance/wrap?upgrade&token=${
          selectedToken === "ETH" ? CONTRACTS.ETHx : CONTRACTS.USDCx
        }`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          fontSize: "14px",
          color: "#4CAF50",
          textDecoration: "none",
          marginTop: "10px",
        }}
      >
        Get {selectedToken}x →
      </a>
    </div>
  );
}
