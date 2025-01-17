"use client";

import { ConnectKitButton } from "connectkit";
import { StreamForm } from "@/components/StreamForm";
import { Footer } from "@/components/Footer";
import { StreamList } from "@/components/StreamList";
import {
  ConditionalStreamList,
  ConditionalStreamListRef,
} from "@/components/ConditionalStreamList";
import { ConditionalStreamForm } from "@/components/ConditionalStreamForm";
import { useRef } from "react";

export default function Home() {
  // Create a ref to hold the list's createStream function
  const conditionalListRef = useRef<ConditionalStreamListRef>(null);

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

      <div
        style={{
          marginTop: "60px",
          borderTop: "1px solid #eee",
          paddingTop: "40px",
        }}
      >
        <h2
          style={{
            fontSize: "clamp(20px, 4vw, 24px)",
            fontWeight: "bold",
            marginBottom: "20px",
          }}
        >
          Conditional Streams
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: "#666",
            marginBottom: "30px",
            padding: "0 20px",
            lineHeight: "1.5",
          }}
        >
          Create streams that require daily fitness activity.
          <br />
          Perfect for fitness challenges and accountability.
        </p>
        <ConditionalStreamForm
          onSubmit={async (receiver, token, flowRate, conditions) => {
            if (conditionalListRef.current) {
              await conditionalListRef.current.createConditionalStream(
                receiver,
                token,
                flowRate,
                conditions
              );
            }
          }}
        />
        <ConditionalStreamList ref={conditionalListRef} />
      </div>

      <Footer />
    </div>
  );
}
