/**
 * app/api/passports/green-tax-export.xlsx/route.ts
 * -----------------------------------------------------------------------
 * GET /api/passports/green-tax-export.xlsx — streams the Green Accounting
 * + Green Valuation History workbook (Sprint 3.2). See
 * lib/services/generate-ledger-workbook.ts's generateGreenTaxWorkbook().
 *
 * Deliberately public / no RBAC gate — same reasoning as
 * app/api/passports/green-tax-report.pdf/route.ts and the two pre-existing
 * export routes (compliance-report.pdf, ledger-export.xlsx): this is a
 * download-only convenience route for a button on the already-
 * unauthenticated /admin/green-accounting page, not a new data-exposure
 * surface. Sprint 3.1's app/api/green-accounting/* JSON routes remain
 * ADMIN-gated — those are for external/programmatic callers.
 *
 * export const runtime = "nodejs": exceljs relies on Node Buffer/stream
 * APIs not available on the Edge runtime — same requirement as
 * ledger-export.xlsx.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateGreenTaxWorkbook } from "@/lib/services/generate-ledger-workbook";
import { authorizeApiRequest } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Access-control audit (2026-09-30): ADMIN only (session or API key).
  const auth = await authorizeApiRequest(req, ["ADMIN"]);
  if (!auth.ok) return auth.response;

  try {
    const workbookBuffer = await generateGreenTaxWorkbook();
    const dateStamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(workbookBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="dpp-polymer-green-tax-export-${dateStamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/passports/green-tax-export.xlsx failed:", error);
    return NextResponse.json({ success: false, error: "Failed to generate green tax export workbook" }, { status: 500 });
  }
}
