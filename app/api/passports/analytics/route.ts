/**
 * app/api/passports/analytics/route.ts
 * -----------------------------------------------------------------------
 * GET /api/passports/analytics — live monthly PCR / compliance trend,
 * backing the home dashboard's area chart (app/page.tsx). See
 * lib/services/passport-monthly-trend.ts for the aggregation and why it's
 * a separate computation from the ESG Analytics dashboard's own trend.
 *
 * Read-only and unauthenticated, matching GET /api/passports — this repo's
 * existing convention is that GET routes are open and only mutating routes
 * (POST/PATCH) are RBAC-gated (see lib/rbac.ts).
 *
 * ?months= (optional, default 12, 0 = full history) caps how many trailing
 * monthly buckets are returned — mirrors the ?page/?pageSize pattern on
 * GET /api/passports.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPassportMonthlyTrend } from "@/lib/services/passport-monthly-trend";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const monthsRaw = Number(searchParams.get("months") ?? "12");
    const months = Number.isFinite(monthsRaw) && monthsRaw >= 0 ? Math.floor(monthsRaw) : 12;

    const data = await getPassportMonthlyTrend(months);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/passports/analytics failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load passport analytics", data: [] },
      { status: 500 }
    );
  }
}
