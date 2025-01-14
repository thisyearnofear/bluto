export type Platform = "ens" | "lens" | "farcaster" | "address";

export interface ProfileResponse {
  address: string;
  identity: string;
  platform: string;
  displayName: string;
  avatar: string | null;
  description: string | null;
}

export interface ResolvedProfile {
  address: string | null;
  displayName: string | null;
  avatar: string | null;
  platform: string | null;
}
