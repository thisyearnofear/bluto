import { useState, useEffect } from "react";
import { Platform, ResolvedProfile } from "@/types/profile";
import { ethers } from "ethers";

export function useNameResolution(input: string, platform: Platform) {
  const [profile, setProfile] = useState<ResolvedProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function resolveIdentity() {
      if (!input) {
        setProfile(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let endpoint = "https://api.web3.bio";

        if (platform === "address") {
          endpoint += `/ns/${input}`;
        } else {
          endpoint += `/ns/${platform}/${input}`;
        }

        const response = await fetch(endpoint);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (platform === "address") {
          if (data && data.length > 0) {
            setProfile({
              address: data[0].address,
              displayName: data[0].displayName,
              avatar: data[0].avatar,
              platform: data[0].platform,
            });
          } else {
            setProfile({
              address: input,
              displayName: null,
              avatar: null,
              platform: null,
            });
          }
        } else {
          if (data) {
            setProfile({
              address: data.address,
              displayName: data.displayName,
              avatar: data.avatar,
              platform: platform,
            });
          } else {
            setError("Could not resolve name");
          }
        }
      } catch (err) {
        setError("Failed to resolve name");
        console.error("Name resolution error:", err);
      } finally {
        setLoading(false);
      }
    }

    resolveIdentity();
  }, [input, platform]);

  return { profile, loading, error };
}
