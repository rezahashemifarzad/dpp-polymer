/**
 * app/api/admin/supplier-analytics/route.ts
 * -----------------------------------------------------------------------
 * GET /api/admin/supplier-analytics — Supplier Performance & Compliance
 * Ranking summary (lib/services/supplier-analytics.ts), for external
 * callers. Gated to ADMIN, matching every other read route under
 * app/api/admin/* (see app/api/admin/supplier-submissions/route.ts's own
 * comment) — this report ranks suppliers by compliance/performance and
 * names them individually, which is competitively sensitive in the same
 * way the pending-submission queue is privacy-sensitive, so it stays
 * behind the same gate as every other /api/admin/* read.
 *
 * The in-app admin console instead calls getSupplierAnalytics() directly
 * from a Server Component (app/admin/suppliers/page.tsx) — same dual-path
 * pattern used everywhere else in this app.
 */

import { NextRequest, NextResponse } from "next/server";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { getSupplierAnalytics } from "@/lib/services/supplier-analytics";

export async function GET(req: NextRequest) {
  const role = authorize(req, ["ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }

  try {
    const data = await getSupplierAnalytics();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/admin/supplier-analytics failed:", error);
    return NextResponse.json({ success: false, error: "Failed to compute supplier analytics" }, { status: 500 });
  }
}
