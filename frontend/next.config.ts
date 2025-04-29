import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3005',         // Fastify server port
        pathname: '/data/**', // allow anything under /data/
      },
    ],
  }
};

export default nextConfig;