import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // OCR and persistence credentials must stay behind server-side route handlers.
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
