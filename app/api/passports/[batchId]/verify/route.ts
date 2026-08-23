/**
 * app/api/passports/[batchId]/verify/route.ts
 * -----------------------------------------------------------------------
 * PATCH /api/passports/{batchId}/verify — Third-Party Auditor Verification
 * Workflow: an individually-authenticated Auditor formally signs off on
 * (AUDITOR_VERIFIED) or rejects (REJECTED_BY_AUDITOR) a passport currently
 * awaiting review.
 *
 * This endpoint previously existed as a TODO-placeholder (auth was a
 * caller-supplied `auditorId` string in the body — anyone could claim to
 * be any auditor) sitting alongside a dead, never-routed `route.ts.ts`
 * duplicate. Both are now resolved: the duplicate is flagged for manual
 * `git rm` (see project notes — no delete capability was available here),
 * and this file is now the REAL auditor-verification endpoint, gated by a
 * personal per-auditor API key (lib/auditor-auth.ts) instead of a
 * self-reported identifier.
 *
 * Distinct from [batchId]/route.ts's PATCH: that endpoint is gated by the
 * shared AUDITOR/ADMIN role key (lib/rbac.ts) and covers the general
 * DRAFT/PENDING_VERIFICATION/ISSUED transition lattice. This endpoint is
 * narrower on purpose — only PENDING_VERIFICATION -> ISSUED/REVOKED,
 * only reachable by a specific named Auditor, always leaving behind a
 * permanent AuditorVerification row. Use that endpoint for the general
 * shared-role-key case; use this one for the auditor portal's own
 * individually-signed review action.
 *
 * Params are awaited per Next.js 16 App Router conventions (dynamic route
 * params are async in this Next.js version — see AGENTS.md).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAuditor, auditorUnauthorizedResponse } from "@/lib/auditor-auth";
import { submitAuditorVerification } from "@/lib/services/submit-auditor-verification";

const VerifyBodySchema = z.object({
  decision: z.enum(["AUDITOR_VERIFIED", "REJECTED_BY_AUDITOR"]),
  notes: z.string().max(4000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId: rawBatchId } = await params;
  const batchId = decodeURIComponent(rawBatchId);

  const auditor = await authorizeAuditor(req);
  if (!auditor) {
    return auditorUnauthorizedResponse();
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

  const parsed = VerifyBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await submitAuditorVerification(batchId, auditor, parsed.data);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, data: result.data }, { status: result.status });
  } catch (error) {
    console.error(`PATCH /api/passports/${batchId}/verify failed:`, error);
    return NextResponse.json(
      { success: false, error: "Failed to submit auditor verification" },
      { status: 500 }
    );
  }
}
