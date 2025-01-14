"use client";

import { ConnectKitButton } from "connectkit";
import { Web3Provider } from "@/components/Web3Provider";
import { StreamForm } from "@/components/StreamForm";
import { Footer } from "@/components/Footer";

function BlutoApp() {
  return (
    <div
      style={{
        maxWidth: "500px",
        margin: "auto",
        padding: "20px",
        textAlign: "center",
        width: "100%",
      }}
    >
      <h1
        style={{
          fontSize: "clamp(24px, 5vw, 28px)",
          fontWeight: "bold",
          marginBottom: "clamp(20px, 5vh, 40px)",
        }}
      >
        Bluto
      </h1>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "clamp(20px, 5vh, 40px)",
          padding: "0 10px",
        }}
      >
        <ConnectKitButton />
      </div>

      <StreamForm />
      <Footer />
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
