/**
 * app/api/passports/compliance-report.pdf/route.ts
 * -----------------------------------------------------------------------
 * GET /api/passports/compliance-report.pdf — streams the portfolio-wide EU
 * ESPR 2026 compliance report (Sprint 2.3, Enterprise Compliance Reporting
 * & PDF/Excel Export Module). See lib/services/generate-compliance-report-pdf.tsx.
 *
 * Deliberately public / no RBAC gate, matching every other GET route in
 * this app (certificate.pdf, label-sheet.pdf, the ESG Analytics page
 * itself) — this report aggregates data that is already readable through
 * those existing public GET endpoints, so gating this one route would only
 * block the "Export Compliance PDF" button without actually protecting
 * anything.
 *
 * export const runtime = "nodejs" is required: @react-pdf/renderer uses
 * Node APIs (streams, fontkit) not available on the Edge runtime — same
 * requirement as the other PDF routes in this app.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateComplianceReportPdf } from "@/lib/services/generate-compliance-report-pdf";
import { authorizeApiRequest } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Access-control audit (2026-09-30): ADMIN, AUDITOR only (session or API key).
  const auth = await authorizeApiRequest(req, ["ADMIN", "AUDITOR"]);
  if (!auth.ok) return auth.response;

  try {
    const pdfBuffer = await generateComplianceReportPdf();
    const dateStamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="dpp-polymer-compliance-report-${dateStamp}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/passports/compliance-report.pdf failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate compliance report PDF" },
      { status: 500 }
    );
  }
}
