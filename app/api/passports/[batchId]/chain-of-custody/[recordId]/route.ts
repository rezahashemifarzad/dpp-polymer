/**
 * app/api/passports/{batchId}/chain-of-custody/{recordId}/route.ts
 * -----------------------------------------------------------------------
 * PATCH /api/passports/{batchId}/chain-of-custody/{recordId} — an
 * individually-authenticated Auditor reviews one tier record: VERIFIED,
 * FLAGGED, or REJECTED. Gated by lib/auditor-auth.ts's authorizeAuditor()
 * (personal per-auditor key via `x-dpp-auditor-key`) — mirrors
 * .../verify/route.ts's auth, but scoped to a single chain-of-custody
 * record rather than the whole passport's PENDING_VERIFICATION review.
 *
 * Params are awaited per Next.js 16 App Router conventions (dynamic
 * route params are async in this Next.js version — see AGENTS.md).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAuditor, auditorUnauthorizedResponse } from "@/lib/auditor-auth";
import { reviewChainOfCustodyRecord } from "@/lib/services/review-chain-of-custody-record";

const ReviewBodySchema = z.object({
  status: z.enum(["VERIFIED", "FLAGGED", "REJECTED"]),
  reviewNotes: z.string().max(2000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string; recordId: string }> }
) {
  const { batchId: rawBatchId, recordId } = await params;
  const batchId = decodeURIComponent(rawBatchId);

  const auditor = await authorizeAuditor(req);
  if (!auditor) {
    return auditorUnauthorizedResponse();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = ReviewBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await reviewChainOfCustodyRecord(batchId, recordId, auditor, parsed.data);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, data: result.data }, { status: result.status });
  } catch (error) {
    console.error(`PATCH /api/passports/${batchId}/chain-of-custody/${recordId} failed:`, error);
    return NextResponse.json({ success: false, error: "Failed to review chain-of-custody record" }, { status: 500 });
  }
}
