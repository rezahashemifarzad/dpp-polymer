/**
 * app/api/admin/search/route.ts
 * -----------------------------------------------------------------------
 * GET /api/admin/search — Global Search & Multi-Layer Filtering
 * (lib/services/global-search.ts), for external callers. Gated to ADMIN,
 * matching every other read route under app/api/admin/* — this endpoint
 * can surface supplier performance tier data (ADMIN-gated everywhere else
 * in this app, see app/api/admin/supplier-analytics/route.ts's own
 * comment), so it inherits that same, stricter gate even though some of
 * what it also returns (batches, audit log entries) is independently
 * public through their own dedicated routes.
 *
 * The in-app admin console instead calls
 * lib/actions/global-search.ts's Server Action directly — same dual-path
 * pattern used everywhere else in this app.
 *
 * Query params (all optional): q (free text), types (comma-separated
 * SearchEntityType), polymerTypes, dppStatuses, certVerificationStatuses,
 * supplierTiers, auditActions (each comma-separated), dateFrom, dateTo
 * (ISO date strings), limitPerType.
 */

import { NextRequest, NextResponse } from "next/server";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { searchGlobal, ALL_SEARCH_ENTITY_TYPES, type SearchEntityType, type GlobalSearchFilters } from "@/lib/services/global-search";

function csv(params: URLSearchParams, key: string): string[] | undefined {
  const raw = params.get(key);
  if (!raw) return undefined;
  const values = raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return values.length > 0 ? values : undefined;
}

export async function GET(req: NextRequest) {
  const role = authorize(req, ["ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }

  try {
    const params = req.nextUrl.searchParams;

    const rawTypes = csv(params, "types");
    const entityTypes = rawTypes?.filter((t): t is SearchEntityType =>
      (ALL_SEARCH_ENTITY_TYPES as readonly string[]).includes(t)
    );

    const filters: GlobalSearchFilters = {
      query: params.get("q") ?? undefined,
      entityTypes,
      polymerTypes: csv(params, "polymerTypes"),
      dppStatuses: csv(params, "dppStatuses"),
      certVerificationStatuses: csv(params, "certVerificationStatuses"),
      supplierTiers: csv(params, "supplierTiers"),
      auditActions: csv(params, "auditActions"),
      dateFrom: params.get("dateFrom") ?? undefined,
      dateTo: params.get("dateTo") ?? undefined,
      limitPerType: params.get("limitPerType") ? Number(params.get("limitPerType")) : undefined,
    };

    const data = await searchGlobal(filters);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/admin/search failed:", error);
    return NextResponse.json({ success: false, error: "Search failed" }, { status: 500 });
  }
}
