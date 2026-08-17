/**
 * app/api/passports/[batchId]/route.ts
 * -----------------------------------------------------------------------
 * GET /api/passports/:batchId
 *
 * Thin wrapper around lib/verifyPassport.ts — see that file for what
 * "integrityVerified" actually means and why the recompute logic lives
 * there instead of here (shared with the public GS1 resolver page).
 */

import { NextRequest, NextResponse } from "next/server";
import { getVerifiedPassport } from "@/lib/verifyPassport";

export async function GET(
  req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  const result = await getVerifiedPassport(decodeURIComponent(params.batchId));

  if (!result) {
    return NextResponse.json({ error: `No passport found for batchId "${params.batchId}"` }, { status: 404 });
  }

  return NextResponse.json({
    ...result.passport,
    integrityVerified: result.integrityVerified,
  });
}
