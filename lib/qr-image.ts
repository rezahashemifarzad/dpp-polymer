/**
 * lib/qr-image.ts
 * -----------------------------------------------------------------------
 * Sprint 2.2 (Dynamic QR Code Engine & Factory Batch Labeling) — server-side
 * QR image rendering, built on the `qrcode` package (already a package.json
 * dependency; previously unused despite being installed). This is the
 * server-side half of the "robust QR utility": it turns an already-built
 * verification URL into an actual image, ready to embed in a PDF label
 * sheet (see lib/services/generate-qr-label-sheet-pdf.tsx).
 *
 * Deliberately does NOT build or validate the URL itself — every issued
 * passport already has a correct, GS1-compliant `qrCodePayloadUrl`
 * persisted at creation time by lib/qr.ts's buildGs1VerificationUrl(), so
 * this utility just encodes whatever URL string it's given. Client-side
 * QR rendering (the interactive preview/download modal) uses
 * `qrcode.react`'s <QRCodeSVG> directly instead of this file — this file
 * exists for the one case that genuinely needs a server-rendered raster
 * image: embedding into a react-pdf <Image>, which cannot render an SVG
 * component tree.
 */

import QRCode from "qrcode";

export interface QrImageOptions {
  /** Output width/height in pixels. Default 300 — comfortably print-quality
   *  at the ~18mm label size used in the batch label sheet. */
  size?: number;
  /** Quiet-zone width in QR modules. QRCode's own default (4) is generous
   *  for a screen preview; 1 keeps more of a small printed label as
   *  scannable QR data. */
  margin?: number;
}

/**
 * Renders `text` (a full URL — the passport's qrCodePayloadUrl) to a PNG
 * data URL ("data:image/png;base64,...") suitable for a react-pdf <Image>
 * src or a plain <img> src. Error-correction level M (15% recovery) — the
 * same default qrcode.react's <QRCodeSVG> ships with — balances resilience
 * against print smudging/scratches with data density.
 */
export async function generateQrPngDataUrl(text: string, options: QrImageOptions = {}): Promise<string> {
  const { size = 300, margin = 1 } = options;
  return QRCode.toDataURL(text, {
    width: size,
    margin,
    errorCorrectionLevel: "M",
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}
