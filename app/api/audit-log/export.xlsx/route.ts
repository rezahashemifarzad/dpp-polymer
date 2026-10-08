/**
 * app/api/audit-log/export.xlsx/route.ts
 * -----------------------------------------------------------------------
 * GET /api/audit-log/export.xlsx[?action=&actorRole=&dateFrom=&dateTo=&batchId=]
 * — streams a dedicated, full-detail audit ledger workbook (see
 * lib/services/generate-audit-log-workbook.ts), honoring the same filter
 * query params as GET /api/audit-log so "export what I'm viewing" works
 * from the /admin/audit page.
 *
 * Public / no RBAC gate, matching GET /api/passports/ledger-export.xlsx
 * and GET /api/audit-log's own precedent — see either file's banner for
 * the shared rationale (this data is already fully exposed via the
 * existing ledger export).
 *
 * export const runtime = "nodejs": exceljs relies on Node Buffer/stream
 * APIs not available on the Edge runtime (same note as every other
 * export route in this app).
 */

import { NextRequest, NextResponse } from "next/server";
import { AuditAction } from "@prisma/client";
import { generateAuditLogWorkbook } from "@/lib/services/generate-audit-log-workbook";
import type { AuditLogFilters } from "@/lib/services/audit-log-service";
import { authorizeApiRequest } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseFilters(params: URLSearchParams): AuditLogFilters {
  const filters: AuditLogFilters = {};

  const action = params.get("action");
  if (action) filters.action = action as AuditAction;

  const actorRole = params.get("actorRole");
  if (actorRole) filters.actorRole = actorRole;

  const dateFrom = params.get("dateFrom");
  if (dateFrom) {
    const d = new Date(dateFrom);
    if (!Number.isNaN(d.getTime())) filters.dateFrom = d;
  }

  const dateTo = params.get("dateTo");
  if (dateTo) {
    const d = new Date(dateTo);
    if (!Number.isNaN(d.getTime())) filters.dateTo = d;
  }

  const batchId = params.get("batchId");
  if (batchId) filters.batchId = batchId;

  return filters;
}

export async function GET(req: NextRequest) {
  // Access-control audit (2026-09-30): ADMIN, AUDITOR only (session or API key).
  const auth = await authorizeApiRequest(req, ["ADMIN", "AUDITOR"]);
  if (!auth.ok) return auth.response;

  try {
    const filters = parseFilters(req.nextUrl.searchParams);
    const workbookBuffer = await generateAuditLogWorkbook(filters);
    const dateStamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(workbookBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="dpp-polymer-audit-log-export-${dateStamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/audit-log/export.xlsx failed:", error);
    return NextResponse.json({ success: false, error: "Failed to generate audit log export workbook" }, { status: 500 });
  }
}
