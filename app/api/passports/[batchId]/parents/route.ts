/**
 * app/api/passports/[batchId]/parents/route.ts
 * -----------------------------------------------------------------------
 * POST /api/passports/{batchId}/parents — link an existing passport as an
 * upstream parent of this batch (see
 * docs/CIRCULAR_ECONOMY_PLATFORM_UPGRADE_SPEC.md §2.1). External-caller
 * entry point, gated to MANUFACTURER or ADMIN via lib/rbac.ts. The in-app
 * admin UI uses lib/actions/link-batch-genealogy.ts (a Server Action)
 * instead — same pattern as passport creation and certifications.
 *
 * Params are awaited per Next.js 16 App Router conventions (dynamic
 * route params are async in this Next.js version — see AGENTS.md).
 */

import { NextRequest, NextResponse } from "next/server";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { linkBatchGenealogy } from "@/lib/services/link-batch-genealogy";

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
    return NextResponse.json({ success: false, error: "Request body must be valid JSON" }, { status: 400 });
  }

  const input = body as { parentBatchId?: unknown; quantityUsedKg?: unknown; notes?: unknown };
  if (typeof input.parentBatchId !== "string") {
    return NextResponse.json({ success: false, error: "parentBatchId (string) is required" }, { status: 400 });
  }

  try {
    const result = await linkBatchGenealogy(
      batchId,
      {
        parentBatchId: input.parentBatchId,
        quantityUsedKg: typeof input.quantityUsedKg === "number" ? input.quantityUsedKg : undefined,
        notes: typeof input.notes === "string" ? input.notes : undefined,
      },
      role
    );
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error, ...("issues" in result ? { issues: result.issues } : {}) },
        { status: result.status }
      );
    }
    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    console.error(`POST /api/passports/${batchId}/parents failed:`, error);
    return NextResponse.json({ success: false, error: "Failed to link parent batch" }, { status: 500 });
  }
}
