import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  images: { unoptimized: true },
  async rewrites() {
    const origin = process.env.API_ORIGIN || "http://127.0.0.1:8000";
    return {
      beforeFiles: [
        {
          source: "/data/:path*",
          destination: `${origin}/api/snapshots/:path*`,
        },
      ],
      afterFiles: [
        {
          source: "/api/:path*",
          destination: `${origin}/api/:path*`,
        },
      ],
      fallback: [],
    };
  },
};
export default config;
