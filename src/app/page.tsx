"use client";

import { ConnectKitButton } from "connectkit";
import { StreamForm } from "@/components/StreamForm";
import { Footer } from "@/components/Footer";
import { StreamList } from "@/components/StreamList";

export default function Home() {
  return (
    <div
      style={{
        maxWidth: "500px",
        margin: "auto",
        padding: "20px",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontSize: "clamp(24px, 5vw, 28px)",
          fontWeight: "bold",
          marginBottom: "10px",
        }}
      >
        Bluto
      </h1>

      <h3
        style={{
          fontSize: "clamp(16px, 3vw, 18px)",
          marginBottom: "20px",
          color: "#666",
          fontWeight: "normal",
        }}
      >
        Base | Superfluid
      </h3>

      <p
        style={{
          fontSize: "14px",
          color: "#666",
          marginBottom: "40px",
          padding: "0 20px",
          lineHeight: "1.5",
        }}
      >
        Stream ETHx tokens continuously to any address.
        <br />
        • Pay contributors or team members
        <br />
        • Subscription services
        <br />• Regular payments to friends/family
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "40px",
        }}
      >
        <ConnectKitButton />
      </div>

      <StreamForm />
      <StreamList />
      <Footer />
    </div>
  );
}
