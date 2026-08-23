/**
 * app/api/auditor/me/route.ts
 * -----------------------------------------------------------------------
 * GET /api/auditor/me — resolves the presented personal auditor key to its
 * identity (name, organization). Used by the auditor portal's key-entry
 * gate to confirm a pasted key is valid and show "Signed in as ..." before
 * loading the review queue, without ever having the portal store or
 * display the key itself back to the user.
 */

import { NextRequest, NextResponse } from "next/server";
import { authorizeAuditor, auditorUnauthorizedResponse } from "@/lib/auditor-auth";

export async function GET(req: NextRequest) {
  const auditor = await authorizeAuditor(req);
  if (!auditor) {
    return auditorUnauthorizedResponse();
  }

  return NextResponse.json({
    success: true,
    data: {
      id: auditor.id,
      name: auditor.name,
      organization: auditor.organization,
    },
  });
}
