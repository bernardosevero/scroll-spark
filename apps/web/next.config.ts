import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source, with no build step of their own.
  transpilePackages: ["@scroll-spark/api", "@scroll-spark/core", "@scroll-spark/ui"],
};

export default nextConfig;
