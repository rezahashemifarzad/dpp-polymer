/**
 * app/api/passports/green-tax-report.pdf/route.ts
 * -----------------------------------------------------------------------
 * GET /api/passports/green-tax-report.pdf — streams the portfolio-wide
 * Green Tax & Plastic Packaging Compliance Report (Sprint 3.2). See
 * lib/services/generate-green-tax-report-pdf.tsx.
 *
 * Deliberately public / no RBAC gate, matching
 * app/api/passports/compliance-report.pdf/route.ts's own reasoning: the
 * /admin/green-accounting page that links to this export already renders
 * this exact data with no authentication (this app has no session-based
 * auth yet — see lib/rbac.ts's own "interim service-key gate" comment),
 * so gating this download-only convenience route would only block the
 * "Export Green Tax PDF" button, not protect anything the admin page
 * doesn't already show. This is a DIFFERENT scope decision than Sprint
 * 3.1's own app/api/green-accounting/* JSON routes, which stay ADMIN-
 * gated on GET — those exist for genuine external/programmatic callers,
 * while this route exists for a human clicking a button on an
 * already-unauthenticated admin page, exactly like the two pre-existing
 * export buttons (compliance-report.pdf, ledger-export.xlsx).
 *
 * export const runtime = "nodejs" is required: @react-pdf/renderer uses
 * Node APIs (streams, fontkit) not available on the Edge runtime — same
 * requirement as every other PDF route in this app.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateGreenTaxReportPdf } from "@/lib/services/generate-green-tax-report-pdf";
import { authorizeApiRequest } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Access-control audit (2026-09-30): ADMIN only (session or API key).
  const auth = await authorizeApiRequest(req, ["ADMIN"]);
  if (!auth.ok) return auth.response;

  try {
    const pdfBuffer = await generateGreenTaxReportPdf();
    const dateStamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="dpp-polymer-green-tax-report-${dateStamp}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/passports/green-tax-report.pdf failed:", error);
    return NextResponse.json({ success: false, error: "Failed to generate green tax report PDF" }, { status: 500 });
  }
}
