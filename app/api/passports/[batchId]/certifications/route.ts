/**
 * app/api/passports/[batchId]/certifications/route.ts
 * -----------------------------------------------------------------------
 * POST /api/passports/{batchId}/certifications — attach a new
 * certification to an EXISTING passport batch (see
 * docs/COMPLIANCE_CERTIFICATIONS_MODULE_SPEC.md §2.4 and §4 step 5).
 *
 * Gated to MANUFACTURER or ADMIN via lib/rbac.ts — the same interim
 * service-key RBAC already enforced by
 * app/api/passports/[batchId]/route.ts's PATCH handler, rather than a
 * separate ad-hoc secret. Present the assigned key via the
 * `x-dpp-api-key` header (see lib/rbac.ts for how keys map to roles).
 *
 * Params are awaited per Next.js 16 App Router conventions (dynamic
 * route params are async in this Next.js version — see AGENTS.md).
 */

import { NextRequest, NextResponse } from "next/server";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { addCertificationToPassport } from "@/lib/services/add-certification";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;

  const role = authorize(req, ["MANUFACTURER", "ADMIN"]);
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
    const result = await addCertificationToPassport(batchId, body, role);
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
    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    console.error(`POST /api/passports/${batchId}/certifications failed:`, error);
    return NextResponse.json(
      { success: false, error: "Failed to add certification" },
      { status: 500 }
    );
  }
}
