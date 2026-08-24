/**
 * app/api/green-accounting/trends/route.ts
 * -----------------------------------------------------------------------
 * GET /api/green-accounting/trends — quarterly/yearly historical plastic-
 * tax trend + forward forecast (Sprint 3.3). See
 * lib/services/green-tax-trend-forecast.ts.
 *
 * ADMIN-gated for GET — same deliberate deviation from this app's usual
 * "GET is always public" convention as the rest of app/api/green-
 * accounting/* (see app/api/green-accounting/summary/route.ts's own
 * comment): this is portfolio-wide financial data, and Sprint 3.1
 * established this whole namespace as ADMIN-gated even for reads. The
 * /admin/green-accounting page itself calls the service function
 * directly server-side (no RBAC — same as every other admin page in this
 * app, see lib/rbac.ts's own "no session-based auth yet" comment); this
 * route exists for external/programmatic callers only.
 *
 * Optional `?jurisdiction=` query param, defaults to "EU".
 */

import { NextRequest, NextResponse } from "next/server";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { computeGreenTaxTrendForecast } from "@/lib/services/green-tax-trend-forecast";

export async function GET(req: NextRequest) {
  const role = authorize(req, ["ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }

  const jurisdiction = req.nextUrl.searchParams.get("jurisdiction") ?? undefined;

  try {
    const data = await computeGreenTaxTrendForecast(jurisdiction);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/green-accounting/trends failed:", error);
    return NextResponse.json({ success: false, error: "Failed to compute green tax trend forecast" }, { status: 500 });
  }
}
