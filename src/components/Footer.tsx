"use client";

import { useState } from "react";

export function Footer() {
  const [showFaucetTooltip, setShowFaucetTooltip] = useState(false);
  const [showWrapTooltip, setShowWrapTooltip] = useState(false);

  return (
    <footer
      style={{
        marginTop: "clamp(40px, 8vh, 60px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "clamp(15px, 3vh, 20px)",
        width: "100%",
        padding: "0 10px",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "clamp(15px, 4vw, 30px)",
          alignItems: "center",
        }}
      >
        <FooterIcon
          href="https://www.alchemy.com/faucets/base-sepolia"
          emoji="🚰"
          tooltip={showFaucetTooltip}
          setTooltip={setShowFaucetTooltip}
          tooltipText="Get Base Sepolia ETH from the faucet. You need this for transaction gas fees."
          title="Get Base Sepolia ETH"
        />
        <FooterIcon
          href="https://app.superfluid.finance/wrap?upgrade"
          emoji="🔄"
          tooltip={showWrapTooltip}
          setTooltip={setShowWrapTooltip}
          tooltipText="Convert your ETH to ETHx (Super Token) to enable streaming capabilities."
          title="Wrap ETH to ETHx"
        />
      </div>

      <div style={{ display: "flex", gap: "clamp(15px, 4vw, 30px)" }}>
        <SocialIcon
          href="https://paragraph.xyz/@papajams.eth"
          src="/paragraph.png"
        />
        <SocialIcon href="https://hey.xyz/u/papajams" src="/lens.png" />
        <SocialIcon href="https://warpcast.com/papa" src="/farcaster.png" />
      </div>
    </footer>
  );
}

function FooterIcon({
  href,
  emoji,
  tooltip,
  setTooltip,
  tooltipText,
  title,
}: {
  href: string;
  emoji: string;
  tooltip: boolean;
  setTooltip: (show: boolean) => void;
  tooltipText: string;
  title: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      onClick={(e) => {
        e.preventDefault();
        setTooltip(!tooltip);
      }}
      style={{
        position: "relative",
        fontSize: "clamp(24px, 6vw, 32px)",
        lineHeight: 1,
        cursor: "pointer",
      }}
    >
      {emoji}
      {tooltip && (
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
            width: "min(200px, 80vw)",
            marginBottom: "8px",
            textAlign: "left",
            zIndex: 10,
          }}
        >
          {tooltipText}
          <div
            style={{
              textAlign: "center",
              marginTop: "8px",
              fontSize: "11px",
              opacity: 0.8,
            }}
          >
            (Click to visit)
          </div>
        </div>
      )}
    </a>
  );
}

function SocialIcon({ href, src }: { href: string; src: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        opacity: 0.7,
        transition: "opacity 0.2s",
        display: "block",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
    >
      <img
        src={src}
        alt=""
        style={{
          width: "clamp(24px, 6vw, 32px)",
          height: "clamp(24px, 6vw, 32px)",
          objectFit: "contain",
        }}
      />
    </a>
  );
}
