import type { NextConfig } from "next";

const distDir = process.env.NEXT_DIST_DIR?.trim();

const nextConfig: NextConfig = {
  ...(distDir ? { distDir } : {}),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typedRoutes: true,
};

export default nextConfig;
