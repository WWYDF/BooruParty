import type { NextConfig } from "next";
import { URL } from 'url';

const fastifyUrl = process.env.NEXT_PUBLIC_FASTIFY || 'http://localhost:3005';
const { hostname, port, protocol } = new URL(fastifyUrl);
const nextjs = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3069');
const parsedProtocol = protocol.replace(':', '') as 'http' | 'https';

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: parsedProtocol,
        hostname,
        port: port || '', // Optional: '' allows any
        pathname: '/data/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3005',
        pathname: '/data/**',
      },
    ],
  },
  allowedDevOrigins: [`${nextjs.hostname}`],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb'
    }
  }
};

export default nextConfig;