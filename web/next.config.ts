import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The SOP documents are read from disk by the /sops/[id]/doc route, so
  // make sure Vercel ships them with it.
  outputFileTracingIncludes: {
    "/sops/[id]/doc": ["./content/sops/**"],
  },
};

export default nextConfig;
