/**
 * app/api/admin/supplier-submissions/[id]/approve/route.ts
 * -----------------------------------------------------------------------
 * POST /api/admin/supplier-submissions/{id}/approve — converts a PENDING
 * SupplierSubmission into a real PolymerPassport via
 * lib/services/supplier-submission.ts's approveSupplierSubmission (which
 * itself calls the canonical createPassport()). Gated to ADMIN via
 * lib/rbac.ts. Params awaited per Next.js 16 App Router conventions.
 *
 * Optional body fields (all overrides — see
 * ApproveSupplierSubmissionOverrides) let the admin fill in whatever the
 * submission itself couldn't reliably supply: gtin, batchId,
 * meltFlowIndex, density, manufacturerId.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { approveSupplierSubmission } from "@/lib/services/supplier-submission";

const OverridesSchema = z.object({
  gtin: z.string().optional(),
  batchId: z.string().optional(),
  meltFlowIndex: z.coerce.number().positive().optional(),
  density: z.coerce.number().positive().optional(),
  manufacturerId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const role = authorize(req, ["ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }

  let overrides: z.infer<typeof OverridesSchema> = {};
  const rawBody = await req.text();
  if (rawBody.trim()) {
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ success: false, error: "Request body must be valid JSON" }, { status: 400 });
    }
    const parsed = OverridesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    overrides = parsed.data;
  }

  try {
    const result = await approveSupplierSubmission(id, role, overrides);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error, issues: "issues" in result ? result.issues : undefined },
        { status: result.status }
      );
    }
    return NextResponse.json({ success: true, data: result.data }, { status: result.status });
  } catch (error) {
    console.error(`POST /api/admin/supplier-submissions/${id}/approve failed:`, error);
    return NextResponse.json({ success: false, error: "Failed to approve supplier submission" }, { status: 500 });
  }
}
