import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const backendUrl = (process.env.BACKEND_URL || (isDev ? "http://localhost:8437" : "https://outreach-engine-h5lx.onrender.com")).replace(/\/$/, "");

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
