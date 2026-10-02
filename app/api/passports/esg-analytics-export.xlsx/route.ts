/**
 * app/api/passports/esg-analytics-export.xlsx/route.ts
 * -----------------------------------------------------------------------
 * GET /api/passports/esg-analytics-export.xlsx — streams the Phase 5 "ESG
 * Data Sheets" workbook (manufacturer distribution, material grade
 * distribution, PPWR regulatory target comparison, and the
 * Sustainability Readiness Index breakdown, alongside the existing ESG
 * summary and monthly trend). See
 * lib/services/generate-esg-analytics-workbook.ts.
 *
 * Deliberately public / no RBAC gate, matching every other export route
 * in this app (ledger-export.xlsx, green-tax-export.xlsx,
 * audit-log/export.xlsx, compliance-report.pdf) — this workbook is built
 * entirely from lib/services/esg-analytics.ts's getEsgAnalytics(), the
 * same aggregation that already backs the public, ungated
 * /admin/esg-analytics page and its CSV/JSON export buttons. Gating this
 * one route would only break the "Export ESG Data Sheets" button without
 * protecting anything not already reachable.
 *
 * export const runtime = "nodejs": exceljs relies on Node Buffer/stream
 * APIs not available on the Edge runtime — same requirement as every
 * other .xlsx export route in this app.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateEsgAnalyticsWorkbook } from "@/lib/services/generate-esg-analytics-workbook";
import { authorizeApiRequest } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Access-control audit (2026-09-30): ADMIN, AUDITOR only (session or API key).
  const auth = await authorizeApiRequest(req, ["ADMIN", "AUDITOR"]);
  if (!auth.ok) return auth.response;

  try {
    const workbookBuffer = await generateEsgAnalyticsWorkbook();
    const dateStamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(workbookBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="polymer-dpp-esg-data-sheets-${dateStamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/passports/esg-analytics-export.xlsx failed:", error);
    return NextResponse.json({ success: false, error: "Failed to generate ESG data sheets workbook" }, { status: 500 });
  }
}
