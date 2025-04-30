import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',    // Leave this entry here
        port: '3005',             // Fastify server port
        pathname: '/data/**',     // allow anything under /data/
      },
      {
        protocol: 'http',
        hostname: '192.168.1.17', // Set this to your fastify server ip
        port: '3005',             // Fastify server port
        pathname: '/data/**',     // allow anything under /data/
      },
    ],
  }
};

export default nextConfig;