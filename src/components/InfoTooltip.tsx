"use client";

import { useState } from "react";

interface InfoTooltipProps {
  content: string | React.ReactNode;
  children: React.ReactNode;
}

export function InfoTooltip({ content, children }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
        <span
          style={{
            marginLeft: "4px",
            cursor: "help",
            opacity: 0.5,
            fontSize: "14px",
          }}
        >
          ⓘ
        </span>
      </div>
      {isVisible && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "rgba(0,0,0,0.8)",
            color: "white",
            padding: "8px 12px",
            borderRadius: "4px",
            fontSize: "12px",
            width: "200px",
            zIndex: 100,
            marginBottom: "8px",
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}
