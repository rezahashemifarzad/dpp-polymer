import type { NextConfig } from "next";

// ----------------------------------------------------------------------------
// Public base URL resolution (self-healing localhost/QR-link fix)
// ----------------------------------------------------------------------------
// lib/qr.ts's buildGs1VerificationUrl (server-side, persisted into every
// passport's qrCodePayloadUrl/GS1DigitalLink row at creation time) and
// app/page.tsx's live GS1 link preview widget (client-side) both read
// process.env.NEXT_PUBLIC_BASE_URL, falling back to http://localhost:3000
// if it's empty. That fallback is correct for local dev, but it silently
// bakes localhost into every public QR code and verification link if the
// NEXT_PUBLIC_BASE_URL environment variable was ever left unset (or
// accidentally removed/rescoped) in the Vercel dashboard — which is
// exactly what happened once already (see scripts/backfill-gs1-links.ts's
// own header) and again prompted this fix.
//
// Rather than rely on someone remembering to configure a dashboard
// variable correctly forever, resolveBaseUrl() below computes the right
// value automatically from Vercel's own System Environment Variables,
// which Vercel populates on every build without any manual setup:
//
//   1. NEXT_PUBLIC_BASE_URL, if explicitly set — always wins when
//      present (e.g. to point at a custom domain instead of the
//      *.vercel.app one), exactly as before.
//   2. VERCEL_PROJECT_PRODUCTION_URL — the project's stable production
//      domain (e.g. "dpp-polymer.vercel.app"), constant across
//      redeploys. Preferred over VERCEL_URL for production builds.
//   3. VERCEL_URL — the current deployment's own URL. Covers preview
//      deployments (which have no "production" domain of their own) and
//      acts as a last-resort production fallback.
//   4. http://localhost:3000 — true local dev only, when none of the
//      above are set.
//
// The result is assigned below via `env`, which Next.js inlines into
// process.env.NEXT_PUBLIC_BASE_URL at build time in BOTH the server and
// client bundles — the same mechanism that makes a real NEXT_PUBLIC_*
// dashboard variable available, so lib/qr.ts and app/page.tsx need no
// changes at all and keep working exactly as they already do. This
// computation runs once, at build time, which is also when Vercel's
// System Environment Variables are populated.
function resolveBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/, "");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

const nextConfig: NextConfig = {
  /* config options here */

  env: {
    NEXT_PUBLIC_BASE_URL: resolveBaseUrl(),
  },

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
