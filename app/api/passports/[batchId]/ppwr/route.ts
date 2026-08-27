/**
 * app/api/passports/[batchId]/ppwr/route.ts
 * -----------------------------------------------------------------------
 * PATCH /api/passports/{batchId}/ppwr — set or update a passport's PPWR
 * recyclability grade and PFAS-threshold compliance. See
 * claude/reach-ppwr-compliance-notes.md and lib/services/declare-ppwr-compliance.ts.
 *
 * Gated to MANUFACTURER or ADMIN via lib/rbac.ts, same convention as every
 * other manufacturer-submitted write in this app. No Auditor review step,
 * same rationale as the SVHC endpoint — this is self-assessed/lab-provided
 * data, not a third-party certificate.
 */

import { NextRequest, NextResponse } from "next/server";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { declarePpwrCompliance } from "@/lib/services/declare-ppwr-compliance";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;

  const role = authorize(req, ["MANUFACTURER", "ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Request body must be valid JSON" }, { status: 400 });
  }

  try {
    const result = await declarePpwrCompliance(batchId, body, role);
    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          ...("issues" in result ? { issues: result.issues } : {}),
        },
        { status: result.status }
      );
    }
    return NextResponse.json({ success: true, data: result.data }, { status: 200 });
  } catch (error) {
    console.error(`PATCH /api/passports/${batchId}/ppwr failed:`, error);
    return NextResponse.json({ success: false, error: "Failed to declare PPWR compliance" }, { status: 500 });
  }
}
