import type { NextConfig } from "next";

/** FastAPI origin for same-origin `/api/v1` rewrites (avoids browser CORS). */
const FASTAPI_PROXY_TARGET = (
  process.env.FASTAPI_PROXY_TARGET ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // Required for multi-stage Docker image (copies .next/standalone).
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${FASTAPI_PROXY_TARGET}/api/v1/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/demo-cognitif-connexion.:ext(mp4|webm)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/demo-cognitif-connexion.jpg",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/logo-rs.png",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
