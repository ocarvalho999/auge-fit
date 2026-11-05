import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O E2E compila em outra pasta para não misturar com o build normal.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
