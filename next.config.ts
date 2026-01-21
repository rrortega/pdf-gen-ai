import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // ppr: 'incremental', // Merged into cacheComponents
  },
  cacheComponents: true,
};

export default nextConfig;
