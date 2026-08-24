/**
 * app/api/certifications/expiry-alerts/route.ts
 * -----------------------------------------------------------------------
 * GET /api/certifications/expiry-alerts — Phase 4 - Step 1: Automated
 * Expiry & Compliance Alerts.
 *
 * Live, computed-fresh portfolio-wide summary (see
 * lib/services/expiry-alert-service.ts's computePortfolioExpiryAlerts).
 * Deliberately public, same convention as GET /api/passports: the admin
 * console that renders this widget (app/admin/page.tsx) has no session
 * auth yet either (see lib/rbac.ts's "interim service-key gate" comment),
 * so gating this read-only route would only break the widget without
 * protecting anything real — every figure here is already derivable from
 * GET /api/passports's own unauthenticated response (batchId,
 * certifications[].validUntil).
 */

import { NextResponse } from "next/server";
import { computePortfolioExpiryAlerts } from "@/lib/services/expiry-alert-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await computePortfolioExpiryAlerts();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/certifications/expiry-alerts failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to compute expiry alerts" },
      { status: 500 }
    );
  }
}
