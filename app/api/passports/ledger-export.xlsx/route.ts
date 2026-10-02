/**
 * app/api/passports/ledger-export.xlsx/route.ts
 * -----------------------------------------------------------------------
 * GET /api/passports/ledger-export.xlsx — streams the Material Ledger +
 * Audit Trail workbook (Sprint 2.3, Enterprise Compliance Reporting &
 * PDF/Excel Export Module). See lib/services/generate-ledger-workbook.ts.
 *
 * Deliberately public / no RBAC gate, matching every other GET route in
 * this app — the workbook aggregates data already readable through the
 * existing public GET /api/passports and the ESG Analytics page; gating
 * this one export route wouldn't protect anything it doesn't already
 * expose, only block the "Download Ledger Excel" button.
 *
 * export const runtime = "nodejs": exceljs (like @react-pdf/renderer)
 * relies on Node Buffer/stream APIs not available on the Edge runtime.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateLedgerWorkbook } from "@/lib/services/generate-ledger-workbook";
import { authorizeApiRequest } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Access-control audit (2026-09-30): ADMIN, AUDITOR only (session or API key).
  const auth = await authorizeApiRequest(req, ["ADMIN", "AUDITOR"]);
  if (!auth.ok) return auth.response;

  try {
    const workbookBuffer = await generateLedgerWorkbook();
    const dateStamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(workbookBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="polymer-dpp-ledger-export-${dateStamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/passports/ledger-export.xlsx failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate ledger export workbook" },
      { status: 500 }
    );
  }
}
