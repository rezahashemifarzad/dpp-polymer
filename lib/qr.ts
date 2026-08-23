/**
 * lib/qr.ts
 * -----------------------------------------------------------------------
 * Builds the GS1 Digital Link URI for a passport batch:
 *
 *   {baseUrl}/01/{GTIN}/21/{BATCH}?v={first16CharsOfRecordHash}
 *
 * IMPORTANT — this path shape must match the real resolver route that
 * already exists in this app: app/01/[gtin]/21/[serialOrBatch]/page.tsx.
 * That page was already built (calling getVerifiedPassport() and
 * PublicScanPage) before this file was touched — it only understands the
 * "/21/" (GS1 AI 21, serial/lot) segment. An earlier version of this file
 * built "/10/" links instead, which pointed at a route that doesn't exist
 * in this app (there is no app/01/[gtin]/10/... page), so every generated
 * QR/link 404'd. Fixed here to match the real, already-working resolver
 * page rather than the other way around.
 *
 * The `v` query parameter is a short, non-secret fingerprint of the full
 * recordHash — enough for a consumer scan to visually cross-check against
 * the value shown in the B2B dashboard without exposing the full hash in
 * every physical QR code. deriveVerificationToken() is exported separately
 * because app/01/[gtin]/21/[serialOrBatch]/page.tsx calls it directly to
 * re-derive the expected token and compare it against the scanned URL's
 * ?v= value (this is the "linkTrusted" check) — it must stay byte-for-byte
 * identical to the token this file embeds when building a link, or every
 * scan will report linkTrusted: false even for an untampered QR code.
 *
 * Base URL comes from NEXT_PUBLIC_BASE_URL (set in .env.local for local
 * dev, and in your hosting provider's env config for staging/production —
 * e.g. NEXT_PUBLIC_BASE_URL=https://dpp.yourcompany.com). It's read here
 * with the NEXT_PUBLIC_ prefix (not a server-only var) deliberately: the
 * same value is also needed client-side (see the GS1 URI preview widget
 * in app/page.tsx), and Next.js only inlines NEXT_PUBLIC_-prefixed vars
 * into the client bundle. Falls back to localhost:3000 if unset, so local
 * dev works out of the box without requiring env setup first.
 */

const DEFAULT_BASE_URL = "http://localhost:3000";
const BATCH_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

/**
 * Derives the short, non-secret verification token embedded in a GS1
 * Digital Link's ?v= query parameter from a full recordHash. Kept as its
 * own named export (not just inlined in buildGs1VerificationUrl) because
 * the public resolver page re-derives it independently, from the DB row's
 * stored recordHash, to check against what's in the scanned URL.
 */
export function deriveVerificationToken(recordHash: string): string {
  return recordHash.slice(0, 16);
}

export function buildGs1VerificationUrl(
  gtin: string,
  batchId: string,
  recordHash: string
): { url: string; path: string } {
  if (!/^\d{14}$/.test(gtin)) {
    throw new Error(`Cannot build GS1 Digital Link: "${gtin}" is not a 14-digit GTIN`);
  }
  if (!batchId || !BATCH_ID_PATTERN.test(batchId)) {
    throw new Error(`Cannot build GS1 Digital Link: "${batchId}" is not a valid batch identifier`);
  }
  if (!recordHash || recordHash.length < 16) {
    throw new Error("Cannot build GS1 Digital Link: recordHash is missing or too short");
  }

  // HARDENING: NEXT_PUBLIC_BASE_URL was previously unset in the Vercel
  // production environment, so every passport created there silently got
  // an http://localhost:3000 GS1 link baked into its persisted
  // qrCodePayloadUrl (see scripts/backfill-gs1-links.ts for the one-off
  // fix to already-created rows). This warning makes that misconfiguration
  // impossible to miss in the server logs going forward, instead of
  // failing silently again.
  if (!process.env.NEXT_PUBLIC_BASE_URL && process.env.NODE_ENV === "production") {
    console.warn(
      "[lib/qr.ts] NEXT_PUBLIC_BASE_URL is not set in this production environment — " +
        `falling back to ${DEFAULT_BASE_URL}, which will be baked into this passport's ` +
        "persisted GS1 link. Set NEXT_PUBLIC_BASE_URL to your real production domain " +
        "in Vercel's Environment Variables and redeploy."
    );
  }

  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const path = `/01/${gtin}/21/${encodeURIComponent(batchId)}`;
  const verificationToken = deriveVerificationToken(recordHash);
  const url = `${baseUrl}${path}?v=${verificationToken}`;

  return { url, path };
}
