"use server";

/**
 * lib/actions/reject-supplier-submission.ts
 * -----------------------------------------------------------------------
 * Server Action backing the admin review queue's "Reject" action. Same
 * server-only trust boundary as the other actions in this feature —
 * external callers use POST /api/admin/supplier-submissions/[id]/reject
 * (ADMIN-gated) instead.
 */

import { rejectSupplierSubmission } from "@/lib/services/supplier-submission";
// Security (2026-09-29): admin-only Server Action. A Server Action is a
// public POST endpoint in its own right, so being mounted only under
// /admin is not a guard. Every export below re-verifies an active ADMIN
// session first (outside any try/catch, so requireAdminSession()'s
// redirect to /login propagates instead of being swallowed).
import { requireAdminSession } from "@/lib/session-auth";

export interface RejectSupplierSubmissionActionResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

function toPlainJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

export async function rejectSupplierSubmissionAction(
  submissionId: string,
  reviewNotes: string
): Promise<RejectSupplierSubmissionActionResult> {
  await requireAdminSession();

  try {
    const result = await rejectSupplierSubmission(submissionId, "ADMIN", reviewNotes);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true, data: toPlainJson(result.data) };
  } catch (error) {
    console.error("rejectSupplierSubmissionAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to reject supplier submission" };
  }
}
