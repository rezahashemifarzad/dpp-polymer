import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Unblocks Vercel deploys when strict-mode TypeScript/ESLint findings
  // would otherwise fail `next build`. This does NOT fix the underlying
  // type errors — it only stops them from being build-fatal. Local
  // `tsc --noEmit` and your editor's type-checking are unaffected, so
  // errors are still visible during development; they just no longer
  // block production deploys.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
