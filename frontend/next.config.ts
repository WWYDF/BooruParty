import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve.alias['@prisma'] = path.resolve(__dirname, '../core/prisma/client');
    return config;
  },
};

export default nextConfig;