import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  allowedDevOrigins: ["santiora.rbexp.com", "autoaugur.rbexp.com"],
};
export default nextConfig;
