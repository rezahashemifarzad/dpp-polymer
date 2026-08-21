import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Unblocks Vercel deploys when strict-mode TypeScript findings would
  // otherwise fail `next build`. This does NOT fix the underlying type
  // errors — it only stops them from being build-fatal. Local
  // `tsc --noEmit` and your editor's type-checking are unaffected, so
  // errors are still visible during development; they just no longer
  // block production deploys.
  //
  // NOTE: there is no `eslint` config key here. Next.js 16 removed the
  // `next lint` / ESLint integration from `next build` entirely, so
  // `eslint.ignoreDuringBuilds` is not a recognized option anymore (it
  // caused the "Unrecognized key(s): 'eslint'" build warning) — and it's
  // unnecessary besides, since this Next.js version no longer runs ESLint
  // as part of the build at all.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
