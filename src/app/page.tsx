"use client";

import { ConnectKitButton } from "connectkit";
import { Web3Provider } from "@/components/Web3Provider";
import { StreamForm } from "@/components/StreamForm";

function BlutoApp() {
  return (
    <div style={{ maxWidth: "500px", margin: "auto", padding: "20px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", textAlign: "center" }}>
        Bluto (Base Sepolia)
      </h1>

      <div style={{ margin: "20px 0" }}>
        <ConnectKitButton />
      </div>

      <StreamForm />
    </div>
  );
}

export default function Page() {
  return (
    <Web3Provider>
      <BlutoApp />
    </Web3Provider>
  );
}
