/**
 * app/api/audit-log/route.ts
 * -----------------------------------------------------------------------
 * GET /api/audit-log — filtered, paginated read of the audit ledger,
 * powering the /admin/audit page.
 *
 * Deliberately public / no RBAC gate, matching GET
 * /api/certifications/expiry-alerts and GET
 * /api/passports/ledger-export.xlsx's own precedent: this exact data
 * (every AuditLog row) is ALREADY fully exposed today through the
 * existing, ungated ledger-export.xlsx route's "Audit Trail" sheet (see
 * lib/services/generate-ledger-workbook.ts) — this route is a better,
 * filterable way to read data that's already public, not a new exposure.
 * Gating it would only break the /admin/audit page without protecting
 * anything real.
 *
 * Query params (all optional): action, actorRole, dateFrom, dateTo
 * (ISO date strings), batchId (substring match), page, pageSize.
 */

import { NextRequest, NextResponse } from "next/server";
import { AuditAction } from "@prisma/client";
import {
  listAuditLogEntries,
  getAuditLogFilterOptions,
  AUDIT_LOG_DEFAULT_PAGE_SIZE,
  type AuditLogFilters,
} from "@/lib/services/audit-log-service";

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
  try {
    const params = req.nextUrl.searchParams;
    const filters = parseFilters(params);
    const page = Number(params.get("page") ?? "1") || 1;
    const pageSize = Number(params.get("pageSize") ?? String(AUDIT_LOG_DEFAULT_PAGE_SIZE)) || AUDIT_LOG_DEFAULT_PAGE_SIZE;

    const [result, filterOptions] = await Promise.all([
      listAuditLogEntries(filters, page, pageSize),
      getAuditLogFilterOptions(),
    ]);

    return NextResponse.json({ success: true, data: { ...result, filterOptions } });
  } catch (error) {
    console.error("GET /api/audit-log failed:", error);
    return NextResponse.json({ success: false, error: "Failed to load audit log" }, { status: 500 });
  }
}
