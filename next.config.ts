import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  experimental: {
    serverActions: {
      bodySizeLimit: "55mb",
    },
    proxyClientMaxBodySize: "60mb",
  },
};

export default nextConfig;
