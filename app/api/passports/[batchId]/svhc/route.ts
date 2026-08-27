/**
 * app/api/passports/[batchId]/svhc/route.ts
 * -----------------------------------------------------------------------
 * PATCH /api/passports/{batchId}/svhc — set or replace a passport's REACH
 * Article 33 SVHC declaration (status + substance list). See
 * claude/reach-ppwr-compliance-notes.md and lib/services/declare-svhc-status.ts.
 *
 * Gated to MANUFACTURER or ADMIN via lib/rbac.ts — same interim role-key
 * RBAC as app/api/passports/[batchId]/certifications/route.ts. There is no
 * separate Auditor review step for this endpoint: an SVHC declaration is
 * the manufacturer's own REACH Article 33 legal statement, not a
 * certificate an Auditor grants — see this feature's service-layer banner
 * for the full rationale.
 *
 * PATCH (not POST) because this replaces the passport's current
 * declaration rather than creating a new sub-resource each call — see
 * declareSvhcStatus's own "replace, don't merge" note.
 */

import { NextRequest, NextResponse } from "next/server";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { declareSvhcStatus } from "@/lib/services/declare-svhc-status";

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
    const result = await declareSvhcStatus(batchId, body, role);
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
    console.error(`PATCH /api/passports/${batchId}/svhc failed:`, error);
    return NextResponse.json({ success: false, error: "Failed to declare SVHC status" }, { status: 500 });
  }
}
