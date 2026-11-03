import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // subset-font loads a WebAssembly file; left to Node it is traced as a normal
  // dependency, while bundling it makes the build trace the whole project.
  serverExternalPackages: ["subset-font"],
  // The PDF report reads its font files at runtime; make sure deployments ship them.
  outputFileTracingIncludes: {
    "/api/stats/report": [
      "./node_modules/@expo-google-fonts/noto-sans-jp/400Regular/NotoSansJP_400Regular.ttf",
      "./node_modules/@expo-google-fonts/noto-sans-jp/700Bold/NotoSansJP_700Bold.ttf",
    ],
  },
  // Which deployment this bundle belongs to. The page compares it with
  // /api/version to tell people a newer version is out (UpdateNotice).
  env: {
    NEXT_PUBLIC_APP_VERSION:
      process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? "dev",
  },
};

export default nextConfig;
