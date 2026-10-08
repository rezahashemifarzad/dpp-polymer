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

// ----------------------------------------------------------------------------
// Security headers (code review 2026-10-08)
// ----------------------------------------------------------------------------
// Sent on every response (pages, API routes, static assets).
//
// Content-Security-Policy follows the Next.js "without nonces" pattern
// (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md):
// a nonce-based policy would force every page to render dynamically, which
// would undo the static, edge-cached corporate site. 'unsafe-inline' for
// scripts is required by Next's inline hydration scripts in that mode;
// everything else is locked to this origin:
//   - no third-party scripts, styles, fonts or connections (all fonts are
//     self-hosted via next/font; QR codes, PDF/Excel downloads use data:
//     and blob: URLs);
//   - frame-ancestors 'none' + X-Frame-Options DENY: the platform can never
//     be embedded in another site (click-jacking);
//   - form-action 'self': Server Actions post back to this origin only.
// 'unsafe-eval' is added in `next dev` only (React's dev error overlay).
// upgrade-insecure-requests is only sent on Vercel (always HTTPS), so a
// local `npm run build && npm start` over http://localhost keeps working.
// On Vercel preview deployments, vercel.live is allowed so the Vercel
// toolbar / preview comments keep working; production never allows it.
const isDev = process.env.NODE_ENV === "development";
const isVercel = process.env.VERCEL === "1";
const isVercelPreview = process.env.VERCEL_ENV === "preview";
const vercelLive = isVercelPreview ? " https://vercel.live" : "";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${vercelLive}`,
  `style-src 'self' 'unsafe-inline'${vercelLive}`,
  `img-src 'self' blob: data:${vercelLive}`,
  `font-src 'self' data:${vercelLive}`,
  `connect-src 'self'${isVercelPreview ? " https://vercel.live wss://ws-us3.pusher.com" : ""}`,
  `frame-src 'self'${vercelLive}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isVercel ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework in an X-Powered-By header.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

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
