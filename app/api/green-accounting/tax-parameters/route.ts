/**
 * app/api/green-accounting/tax-parameters/route.ts
 * -----------------------------------------------------------------------
 * GET  /api/green-accounting/tax-parameters — list all PlasticTaxParameter
 *      rows (optionally filtered by ?jurisdiction=), newest first.
 * POST /api/green-accounting/tax-parameters — create a new tax parameter,
 *      retiring the previous active one for the same jurisdiction (see
 *      lib/services/plastic-tax-calculator.ts's createTaxParameter).
 *
 * ADMIN-gated for both GET and POST — same deliberate deviation from this
 * app's usual "GET is always public" convention as
 * app/api/green-accounting/summary/route.ts, for the same reason
 * (portfolio-wide financial/tax configuration data).
 */

import { NextRequest, NextResponse } from "next/server";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { createTaxParameter, listTaxParameters } from "@/lib/services/plastic-tax-calculator";

export async function GET(req: NextRequest) {
  const role = authorize(req, ["ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }

  const jurisdiction = req.nextUrl.searchParams.get("jurisdiction") ?? undefined;

  try {
    const data = await listTaxParameters(jurisdiction);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/green-accounting/tax-parameters failed:", error);
    return NextResponse.json({ success: false, error: "Failed to list tax parameters" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const role = authorize(req, ["ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Request body must be valid JSON" }, { status: 400 });
  }

  const input = body as {
    jurisdiction?: unknown;
    label?: unknown;
    currency?: unknown;
    ratePerTonne?: unknown;
    source?: unknown;
    notes?: unknown;
  };
  if (typeof input.ratePerTonne !== "number") {
    return NextResponse.json({ success: false, error: "ratePerTonne (number) is required" }, { status: 400 });
  }

  try {
    const data = await createTaxParameter({
      jurisdiction: typeof input.jurisdiction === "string" ? input.jurisdiction : undefined,
      label: typeof input.label === "string" ? input.label : undefined,
      currency: typeof input.currency === "string" ? input.currency : undefined,
      ratePerTonne: input.ratePerTonne,
      source: typeof input.source === "string" ? input.source : undefined,
      notes: typeof input.notes === "string" ? input.notes : undefined,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("POST /api/green-accounting/tax-parameters failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to save tax parameter" },
      { status: 400 }
    );
  }
}
