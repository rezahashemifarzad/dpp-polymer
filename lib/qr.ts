/**
 * DPP-Polymer — QR Code Generation (GS1 Digital Link compliant)
 * -----------------------------------------------------------------------
 * Generates the dynamic QR code that resolves to a passport's public
 * verification page, using GS1 Digital Link URI syntax:
 *
 *   https://dpp.yourdomain.com/01/{GTIN}/21/{SerialOrBatch}?v={token}
 *
 * Why GS1 Digital Link and not an arbitrary URL:
 * - It's the format the EU ESPR / DPP ecosystem is converging on — GS1's
 *   AI (Application Identifier) structure is already how the wider supply
 *   chain (ERP, customs, retail scanning) identifies trade items, so a
 *   passport URL in this shape is machine-readable by systems that have
 *   never heard of DPP-Polymer specifically.
 * - "01" = GTIN (the trade item / product+grade), "21" = Serial Number.
 *   We use AI 21 for the batch identifier per the founder's directive;
 *   note GS1 purists would use AI "10" for a lot/batch number and reserve
 *   "21" for a unique serial — flagged below as a standards trade-off to
 *   revisit once the team decides whether batches are serialized 1:1.
 * - The structure degrades gracefully: any GS1-aware scanner resolves the
 *   path even without our custom "?v=" verification token.
 *
 * Install: npm install qrcode
 *          npm install -D @types/qrcode
 */

import QRCode from "qrcode";
import { createHash } from "crypto";
import { padGtinTo14, isValidGtinCheckDigit } from "./types";

const GS1_DOMAIN = process.env.DPP_GS1_DOMAIN ?? "https://dpp.yourdomain.com";

/**
 * Derives a short (16-char), URL-safe verification token from the full
 * record hash. Appended as a query parameter — GS1 Digital Link explicitly
 * permits additional query parameters alongside the AI path, so this stays
 * spec-compliant while giving us a way to detect a stale/tampered scan
 * without exposing the full recordHash in a URL that third-party scanner
 * apps may log.
 */
export function deriveVerificationToken(recordHash: string): string {
  return createHash("sha256").update(recordHash).digest("base64url").slice(0, 16);
}

export interface Gs1LinkResult {
  url: string;
  gtin: string; // normalized 14-digit form actually used in the path
  token: string;
}

/**
 * Builds the canonical GS1 Digital Link verification URL for a passport.
 *   /01/{GTIN-14}/21/{SerialOrBatch}?v={token}
 * This is the value persisted to PolymerPassport.qrCodePayloadUrl at
 * issuance time and the value encoded into the QR.
 *
 * Throws if the GTIN fails GS1 check-digit validation — we never want to
 * silently issue a QR code pointing at a malformed GTIN.
 */
export function buildGs1VerificationUrl(
  gtin: string,
  serialOrBatch: string,
  recordHash: string
): Gs1LinkResult {
  const gtin14 = padGtinTo14(gtin);
  if (!isValidGtinCheckDigit(gtin14)) {
    throw new Error(`Invalid GTIN check digit for "${gtin}" (normalized: ${gtin14})`);
  }
  const token = deriveVerificationToken(recordHash);
  const encodedSerial = encodeURIComponent(serialOrBatch);
  const url = `${GS1_DOMAIN}/01/${gtin14}/21/${encodedSerial}?v=${token}`;
  return { url, gtin: gtin14, token };
}

export interface QrGenerationOptions {
  /** "svg" for print/packaging (scales losslessly), "png" for dashboard previews/downloads. */
  format?: "svg" | "png";
  /** Pixel size for PNG output. Ignored for SVG. */
  size?: number;
  /** Error correction: "H" (30%) recommended for anything printed on curved/textured packaging. */
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
}

/**
 * Generates the QR code for a given passport and returns both the GS1
 * Digital Link URL and the rendered QR:
 * - format "svg" -> raw <svg> markup, safe to inline or save as .svg
 * - format "png" -> base64 data URL, safe to use directly in an <img src>
 */
export async function generatePassportQrCode(
  gtin: string,
  serialOrBatch: string,
  recordHash: string,
  options: QrGenerationOptions = {}
): Promise<Gs1LinkResult & { qr: string }> {
  const { format = "svg", size = 512, errorCorrectionLevel = "H" } = options;
  const { url, gtin: gtin14, token } = buildGs1VerificationUrl(gtin, serialOrBatch, recordHash);

  const qr =
    format === "svg"
      ? await QRCode.toString(url, { type: "svg", errorCorrectionLevel, margin: 1 })
      : await QRCode.toDataURL(url, { width: size, errorCorrectionLevel, margin: 1 });

  return { url, gtin: gtin14, token, qr };
}

/* ---------------------------------------------------------------------------
 * Example wiring: Next.js App Router API route
 * GET /api/passports/[batchId]/qrcode?format=svg|png
 * (See app/api/passports/[batchId]/route.ts for the passport lookup itself —
 * this route is intentionally separate so QR generation can be cached /
 * CDN-fronted independently of the JSON passport payload.)
 * ------------------------------------------------------------------------*/

/*
// app/api/passports/[batchId]/qrcode/route.ts

import { NextRequest, NextResponse } from "next/server";
import { generatePassportQrCode } from "@/lib/qr";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  const passport = await prisma.polymerPassport.findUnique({
    where: { batchId: params.batchId },
    select: { batchId: true, gtin: true, recordHash: true, status: true },
  });

  if (!passport || passport.status === "DRAFT") {
    return NextResponse.json({ error: "Passport not found or not yet issued" }, { status: 404 });
  }

  const format = (req.nextUrl.searchParams.get("format") as "svg" | "png") ?? "svg";
  const { qr } = await generatePassportQrCode(passport.gtin, passport.batchId, passport.recordHash, { format });

  return format === "svg"
    ? new NextResponse(qr, { headers: { "Content-Type": "image/svg+xml" } })
    : NextResponse.json({ dataUrl: qr });
}
*/
