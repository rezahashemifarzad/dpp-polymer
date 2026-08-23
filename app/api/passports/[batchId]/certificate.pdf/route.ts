/**
 * app/api/passports/[batchId]/certificate.pdf/route.ts
 * -----------------------------------------------------------------------
 * GET /api/passports/{batchId}/certificate.pdf — streams a "Certificate of
 * Conformity" PDF for this batch (Circular Economy Platform Upgrade,
 * Step 4 §3). See lib/services/generate-certificate-pdf.tsx.
 *
 * Deliberately public / no RBAC gate: this is the same data already shown
 * on the public GS1 scan page (app/01/[gtin]/21/[serialOrBatch]/page.tsx)
 * for this exact batch, just packaged as a printable/downloadable
 * document — gating it would only block the public "Download Official
 * Certificate" button on that page from working.
 *
 * export const runtime = "nodejs" is required: @react-pdf/renderer uses
 * Node APIs (streams, fontkit) that don't exist on the Edge runtime.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateCertificatePdf } from "@/lib/services/generate-certificate-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;

  try {
    const pdfBuffer = await generateCertificatePdf(batchId);
    if (!pdfBuffer) {
      return NextResponse.json(
        { success: false, error: `No passport found for batch "${batchId}"` },
        { status: 404 }
      );
    }

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="dpp-certificate-${batchId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(`GET /api/passports/${batchId}/certificate.pdf failed:`, error);
    return NextResponse.json({ success: false, error: "Failed to generate certificate PDF" }, { status: 500 });
  }
}
