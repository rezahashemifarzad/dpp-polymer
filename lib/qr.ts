/**
 * lib/qr.ts
 * -----------------------------------------------------------------------
 * Builds the GS1 Digital Link URI for a passport batch:
 *
 *   {baseUrl}/01/{GTIN}/10/{BATCH}?v={first16CharsOfRecordHash}
 *
 * The `v` query parameter is a short, non-secret fingerprint of the full
 * recordHash — enough for a consumer scan to visually cross-check against
 * the value shown in the B2B dashboard without exposing the full hash in
 * every physical QR code.
 */

const DEFAULT_BASE_URL = "https://dpp.polymer.eu";
const BATCH_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

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

  const baseUrl = (process.env.DPP_PUBLIC_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const path = `/01/${gtin}/10/${encodeURIComponent(batchId)}`;
  const verificationToken = recordHash.slice(0, 16);
  const url = `${baseUrl}${path}?v=${verificationToken}`;

  return { url, path };
}
