import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["mongoose", "bcryptjs"],
  images: {
    // Brand assets use plain <img> + /api/brand/media; keep local static defaults allowed
    localPatterns: [
      { pathname: "/Images/**" },
      { pathname: "/api/brand/media/**" },
      { pathname: "/logo.avif" },
    ],
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  allowedDevOrigins: ['aibansos.my.id'],
};

export default nextConfig;
