import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O E2E compila em outra pasta para não misturar com o build normal.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["sharp"],
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
};

export default nextConfig;
