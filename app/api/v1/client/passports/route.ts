/**
 * app/api/v1/client/passports/route.ts
 * -----------------------------------------------------------------------
 * GET /api/v1/client/passports — the Buyer API. Lets an external ERP
 * system pull this buyer's purchased batches and their circularity data
 * programmatically, using the same personal-company API key their portal
 * session uses (lib/client-auth.ts, `x-dpp-client-key` header).
 *
 * Versioned under /api/v1/ deliberately — unlike this app's other
 * internal REST routes (/api/passports/...), this endpoint is meant to be
 * integrated against by a THIRD PARTY's system and kept stable. Breaking
 * changes to the response shape should land as /api/v2/, not as an
 * in-place change here.
 *
 * Response shape is the same ClientPortfolioSummary that powers
 * app/client-portal/page.tsx (via lib/services/get-client-portfolio.ts) —
 * one implementation, so a number an ERP pulls here can never disagree
 * with what the buyer sees in their own portal.
 */

import { NextRequest, NextResponse } from "next/server";
import { authorizeClient, clientUnauthorizedResponse } from "@/lib/client-auth";
import { getClientPortfolio } from "@/lib/services/get-client-portfolio";

export async function GET(req: NextRequest) {
  const client = await authorizeClient(req);
  if (!client) {
    return clientUnauthorizedResponse();
  }

  try {
    const portfolio = await getClientPortfolio(client.id);
    if (!portfolio) {
      // Should be unreachable — authorizeClient already confirmed this
      // Client row exists — but handled explicitly rather than assumed.
      return NextResponse.json({ success: false, error: "Client account not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: portfolio });
  } catch (error) {
    console.error(`GET /api/v1/client/passports failed for client ${client.id}:`, error);
    return NextResponse.json(
      { success: false, error: "Failed to load purchased batches" },
      { status: 500 }
    );
  }
}
