/**
 * app/api/passports/svhc-alerts/route.ts
 * -----------------------------------------------------------------------
 * GET /api/passports/svhc-alerts — portfolio-wide REACH Article 33 SVHC
 * compliance summary, powering the admin dashboard's SVHC compliance
 * banner. Follow-up to the REACH/PPWR dashboard UI sprint (see
 * claude/reach-ppwr-dashboard-ui-notes.md's "Explicitly not built" note).
 *
 * Mirrors app/api/certifications/expiry-alerts/route.ts exactly: same
 * dynamic export, same unauthenticated GET (every figure here is already
 * derivable from GET /api/passports's own unauthenticated response —
 * batchId, svhcStatus), same {success, data} / {success, error} shape.
 */

import { NextResponse } from "next/server";
import { computePortfolioSvhcSummary } from "@/lib/services/svhc-compliance-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await computePortfolioSvhcSummary();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/passports/svhc-alerts failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to compute SVHC compliance alerts" },
      { status: 500 }
    );
  }
}
