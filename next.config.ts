import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // dynamicIO: true, 
    scrollRestoration: true,
  },
  cacheComponents: true,
  compress: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
