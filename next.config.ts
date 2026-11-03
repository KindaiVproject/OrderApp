import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Which deployment this bundle belongs to. The page compares it with
  // /api/version to tell people a newer version is out (UpdateNotice).
  env: {
    NEXT_PUBLIC_APP_VERSION:
      process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? "dev",
  },
};

export default nextConfig;
