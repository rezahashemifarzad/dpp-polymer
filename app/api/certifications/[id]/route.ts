/**
 * app/api/certifications/[id]/route.ts
 * -----------------------------------------------------------------------
 * PATCH /api/certifications/{id} — verify or reject a certification (see
 * docs/COMPLIANCE_CERTIFICATIONS_MODULE_SPEC.md §4 step 4).
 *
 * Gated to AUDITOR or ADMIN via lib/rbac.ts, mirroring the same
 * separation-of-duties rule already enforced for whole passports in
 * app/api/passports/[batchId]/route.ts: the manufacturer who attached a
 * certification is never the same actor who confirms it. Present the
 * assigned key via the `x-dpp-api-key` header (see lib/rbac.ts).
 *
 * Params are awaited per Next.js 16 App Router conventions (dynamic
 * route params are async in this Next.js version — see AGENTS.md).
 */

import { NextRequest, NextResponse } from "next/server";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { verifyCertification } from "@/lib/services/verify-certification";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const role = authorize(req, ["AUDITOR", "ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  try {
    const result = await verifyCertification(id, body, role);
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
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error(`PATCH /api/certifications/${id} failed:`, error);
    return NextResponse.json(
      { success: false, error: "Failed to update certification" },
      { status: 500 }
    );
  }
}
