import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TXT imports (up to 2 MB) and persona texts go through server actions.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
