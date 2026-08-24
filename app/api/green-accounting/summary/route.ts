/**
 * app/api/green-accounting/summary/route.ts
 * -----------------------------------------------------------------------
 * GET /api/green-accounting/summary — portfolio-wide Green Accounting &
 * EU Plastic Tax figures (gross liability, PCR-based tax savings, net
 * liability), computed fresh on every call (see lib/services/
 * plastic-tax-calculator.ts's file banner).
 *
 * Deliberate deviation from this app's usual "GET is always public" RBAC
 * convention (see lib/rbac.ts and every other GET route in this app):
 * this endpoint is ADMIN-gated even for reads, because it surfaces
 * portfolio-wide financial/tax figures, and the Sprint 3.1 request
 * explicitly asked for "secure API endpoints for green financial data."
 * Documented in claude/sprint-3.1-green-accounting-notes.md.
 *
 * Optional `?jurisdiction=` query param, defaults to "EU".
 */

import { NextRequest, NextResponse } from "next/server";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { computePortfolioGreenAccounting } from "@/lib/services/plastic-tax-calculator";

export async function GET(req: NextRequest) {
  const role = authorize(req, ["ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }

  const jurisdiction = req.nextUrl.searchParams.get("jurisdiction") ?? undefined;

  try {
    const data = await computePortfolioGreenAccounting(jurisdiction);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/green-accounting/summary failed:", error);
    return NextResponse.json({ success: false, error: "Failed to compute green accounting summary" }, { status: 500 });
  }
}
