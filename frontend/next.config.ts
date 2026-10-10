import type { NextConfig } from "next";

const backendUrl = (process.env.BACKEND_URL || "https://outreach-engine-h5lx.onrender.com").replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
