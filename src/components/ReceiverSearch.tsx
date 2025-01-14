import { useState } from "react";
import { Platform } from "@/types/profile";
import { useNameResolution } from "@/hooks/useNameResolution";
import { ethers } from "ethers";

interface ReceiverSearchProps {
  onSelect: (address: string) => void;
}

export function ReceiverSearch({ onSelect }: ReceiverSearchProps) {
  const [input, setInput] = useState("");
  const [platform, setPlatform] = useState<Platform>("address");
  const [searchTerm, setSearchTerm] = useState("");
  const { profile, loading, error } = useNameResolution(searchTerm, platform);

  const handleSearch = () => {
    if (!input) return;

    if (platform === "address" && !ethers.utils.isAddress(input)) {
      return;
    }

    setSearchTerm(input);
  };

  const handleSelect = () => {
    if (profile?.address) {
      onSelect(profile.address);
    }
  };

  return (
    <div className="receiver-search">
      <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          style={{ padding: "10px" }}
        >
          <option value="address">Address</option>
          <option value="ens">ENS</option>
          <option value="lens">Lens</option>
          <option value="farcaster">Farcaster</option>
        </select>
        <input
          placeholder={
            platform === "address"
              ? "Enter Ethereum address"
              : `Enter ${platform.toUpperCase()} handle`
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ flex: 1, padding: "10px" }}
        />
        <button
          onClick={handleSearch}
          style={{
            padding: "10px 20px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Search
        </button>
      </div>

      {loading && <div>Searching...</div>}

      {error && <div style={{ color: "red" }}>{error}</div>}

      {profile && (
        <div
          onClick={handleSelect}
          style={{
            marginTop: "5px",
            padding: "10px",
            backgroundColor: "#f5f5f5",
            borderRadius: "5px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
          }}
        >
          {profile.avatar && (
            <img
              src={profile.avatar}
              alt="Profile"
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "12px",
                marginRight: "8px",
              }}
            />
          )}
          <div>
            {profile.displayName && (
              <div style={{ fontWeight: "bold" }}>{profile.displayName}</div>
            )}
            <div style={{ fontSize: "0.9em", color: "#666" }}>
              {profile.address}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
