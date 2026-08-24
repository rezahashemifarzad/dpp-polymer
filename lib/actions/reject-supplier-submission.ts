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
