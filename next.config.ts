import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingIncludes: {
    "/*": ["./data/pantrymuse.db"],
    "/api/**/*": ["./data/pantrymuse.db"],
    "/recipe/**/*": ["./data/pantrymuse.db"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "www.allrecipes.com",
      },
      {
        protocol: "https",
        hostname: "imagesvc.meredithcorp.io",
      },
      {
        protocol: "https",
        hostname: "*.allrecipes.com",
      }
    ],
  },
};

export default nextConfig;
