/**
 * app/api/admin/supplier-submissions/[id]/reject/route.ts
 * -----------------------------------------------------------------------
 * POST /api/admin/supplier-submissions/{id}/reject — declines a PENDING
 * SupplierSubmission with required feedback (reviewNotes). Gated to ADMIN
 * via lib/rbac.ts. Params awaited per Next.js 16 App Router conventions.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { rejectSupplierSubmission } from "@/lib/services/supplier-submission";

const RejectSchema = z.object({
  reviewNotes: z.string().min(1, "reviewNotes is required when rejecting a submission"),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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

  const parsed = RejectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await rejectSupplierSubmission(id, role, parsed.data.reviewNotes);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error(`POST /api/admin/supplier-submissions/${id}/reject failed:`, error);
    return NextResponse.json({ success: false, error: "Failed to reject supplier submission" }, { status: 500 });
  }
}
