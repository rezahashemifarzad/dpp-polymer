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
 *
 * One deliberate addition beyond that mirror: a SchemaOutOfDateError from
 * computePortfolioSvhcSummary() (see lib/services/schema-drift.ts) is
 * caught separately and returned as its own actionable message with a
 * 503, instead of falling into the generic 500 branch below — this
 * project has no migration history, so a database that hasn't had
 * `npx prisma db push` run against it since svhcStatus was added throws
 * exactly this, and the admin console's error banner shows `error`
 * verbatim, so the fix should be visible there, not just in server logs.
 */

import { NextResponse } from "next/server";
import { computePortfolioSvhcSummary } from "@/lib/services/svhc-compliance-service";
import { SchemaOutOfDateError } from "@/lib/services/schema-drift";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await computePortfolioSvhcSummary();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof SchemaOutOfDateError) {
      console.error("GET /api/passports/svhc-alerts: schema out of date —", error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 503 });
    }
    console.error("GET /api/passports/svhc-alerts failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to compute SVHC compliance alerts" },
      { status: 500 }
    );
  }
}
