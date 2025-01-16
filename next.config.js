/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      fs: false,
      net: false,
      tls: false,
      "cross-fetch": require.resolve("cross-fetch"),
    };
    return config;
  },
  transpilePackages: [
    "@metamask/sdk",
    "@wagmi/connectors",
    "connectkit",
    "wagmi",
  ],
  experimental: {
    optimizeFonts: true,
    esmExternals: "loose",
  },
};

module.exports = nextConfig;
