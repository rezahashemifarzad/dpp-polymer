/**
 * app/api/passports/[batchId]/green-valuation/route.ts
 * -----------------------------------------------------------------------
 * GET  /api/passports/{batchId}/green-valuation — live (never persisted)
 *      Green Accounting figures for this batch.
 * POST /api/passports/{batchId}/green-valuation — lock the current live
 *      figures into a persisted BatchGreenValuation snapshot (see
 *      lib/services/plastic-tax-calculator.ts's saveBatchGreenValuation).
 *
 * ADMIN-gated for both GET and POST — same deliberate deviation from this
 * app's usual "GET is always public" convention as the other
 * green-accounting routes, for the same reason (financial/tax data).
 *
 * Params are awaited per Next.js 16 App Router conventions (dynamic route
 * params are async in this Next.js version — see AGENTS.md).
 */

import { NextRequest, NextResponse } from "next/server";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { computeBatchGreenAccounting, saveBatchGreenValuation } from "@/lib/services/plastic-tax-calculator";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;

  const role = authorize(req, ["ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }

  const jurisdiction = req.nextUrl.searchParams.get("jurisdiction") ?? undefined;

  try {
    const data = await computeBatchGreenAccounting(batchId, jurisdiction);
    if (!data) {
      return NextResponse.json({ success: false, error: `No passport found for batchId "${batchId}"` }, { status: 404 });
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error(`GET /api/passports/${batchId}/green-valuation failed:`, error);
    return NextResponse.json({ success: false, error: "Failed to compute green valuation" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;

  const role = authorize(req, ["ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }

  let jurisdiction: string | undefined;
  try {
    const body = (await req.json().catch(() => ({}))) as { jurisdiction?: unknown };
    jurisdiction = typeof body?.jurisdiction === "string" ? body.jurisdiction : undefined;
  } catch {
    jurisdiction = undefined;
  }

  try {
    const result = await saveBatchGreenValuation(batchId, role, jurisdiction);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error(`POST /api/passports/${batchId}/green-valuation failed:`, error);
    return NextResponse.json({ success: false, error: "Failed to save green valuation" }, { status: 500 });
  }
}
