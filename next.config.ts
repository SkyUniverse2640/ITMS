import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: process.cwd(),
  },
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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
