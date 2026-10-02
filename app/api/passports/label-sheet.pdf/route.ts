/**
 * app/api/passports/label-sheet.pdf/route.ts
 * -----------------------------------------------------------------------
 * GET /api/passports/label-sheet.pdf?batchIds=A,B,C — streams a print-ready
 * A4 PDF sheet of QR labels for the given batches (Sprint 2.2, Dynamic QR
 * Code Engine & Factory Batch Labeling). See
 * lib/services/generate-qr-label-sheet-pdf.tsx.
 *
 * Query string (not a POST body) so the admin UI can trigger this as a
 * plain download — a `<a href>`/`window.open()` — without a fetch+blob
 * round trip, the same reason GET /api/passports/{batchId}/certificate.pdf
 * is also a plain GET. batchIds are comma-separated (batch IDs never
 * contain commas — see lib/qr.ts's BATCH_ID_PATTERN) rather than repeated
 * query params, which keeps a 100+ batch selection well under typical URL
 * length limits.
 *
 * Deliberately public / no RBAC gate, matching GET /api/passports and GET
 * .../certificate.pdf: every field on a label (batchId, GTIN, polymer
 * type/grade, and a link to the already-public verification page) is
 * already public information once a passport is issued — gating this
 * route would only block the admin console's own "Print Labels" button.
 *
 * export const runtime = "nodejs" is required: @react-pdf/renderer uses
 * Node APIs (streams, fontkit) not available on the Edge runtime — same
 * requirement as the certificate.pdf route.
 *
 * Phase 6 (Batch Certificate & Dynamic QR Generator Suite) additions:
 * two new optional query params, both passed straight through to
 * generateQrLabelSheetPdf's own `options` (which does the actual
 * validation/clamping — this route only narrows the raw string to the
 * union type it accepts):
 *   - `layout=grid|large` — omitted or any other value falls back to
 *     "grid", matching the service's own default.
 *   - `copiesPerBatch=<n>` — omitted or non-numeric falls back to
 *     undefined so the service applies its own default (1).
 * Neither changes this route's existing behavior for callers that don't
 * pass them (the admin "Print Labels" button, currently unaware of
 * these params).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  generateQrLabelSheetPdf,
  type LabelSheetLayout,
} from "@/lib/services/generate-qr-label-sheet-pdf";
import { authorizeApiRequest } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A generous but bounded cap — protects against an accidental "select all"
// on a very large ledger producing a PDF with hundreds of embedded raster
// images (slow to render, unwieldy to actually print/cut). 200 batches is
// 20 A4 pages at 10 labels/page, already a lot of physical labels for one
// print run.
const MAX_BATCHES_PER_SHEET = 200;

export async function GET(req: NextRequest) {
  // Access-control audit (2026-09-30): ADMIN, MANUFACTURER only (session or API key).
  const auth = await authorizeApiRequest(req, ["ADMIN", "MANUFACTURER"]);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("batchIds") ?? "";
  const batchIds = Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );

  if (batchIds.length === 0) {
    return NextResponse.json(
      { success: false, error: "No batchIds provided — pass ?batchIds=BATCH-1,BATCH-2,..." },
      { status: 400 }
    );
  }
  if (batchIds.length > MAX_BATCHES_PER_SHEET) {
    return NextResponse.json(
      {
        success: false,
        error: `Too many batches requested (${batchIds.length}); a single sheet is capped at ${MAX_BATCHES_PER_SHEET}.`,
      },
      { status: 400 }
    );
  }

  const layoutParam = searchParams.get("layout");
  const layout: LabelSheetLayout | undefined = layoutParam === "large" ? "large" : layoutParam === "grid" ? "grid" : undefined;

  const copiesParam = searchParams.get("copiesPerBatch");
  const copiesPerBatch = copiesParam !== null && copiesParam.trim() !== "" && !Number.isNaN(Number(copiesParam))
    ? Number(copiesParam)
    : undefined;

  try {
    const pdfBuffer = await generateQrLabelSheetPdf(batchIds, { layout, copiesPerBatch });
    if (!pdfBuffer) {
      return NextResponse.json(
        { success: false, error: "None of the requested batches have a recorded QR link yet" },
        { status: 404 }
      );
    }

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="dpp-batch-labels-${batchIds.length}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/passports/label-sheet.pdf failed:", error);
    return NextResponse.json({ success: false, error: "Failed to generate label sheet PDF" }, { status: 500 });
  }
}
