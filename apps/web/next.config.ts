import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repo has its own AGENTS.md, so next dev shouldn't write another one.
  agentRules: false,
  // Workspace packages ship TypeScript source, with no build step of their own.
  transpilePackages: ["@scroll-spark/api", "@scroll-spark/core", "@scroll-spark/ui"],
};

export default nextConfig;
