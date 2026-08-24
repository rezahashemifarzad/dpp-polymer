"use server";

/**
 * lib/actions/approve-supplier-submission.ts
 * -----------------------------------------------------------------------
 * Server Action backing the admin review queue's "Approve" action. Same
 * server-only trust boundary as lib/actions/create-passport.ts — external
 * callers use POST /api/admin/supplier-submissions/[id]/approve
 * (ADMIN-gated) instead.
 */

import {
  approveSupplierSubmission,
  type ApproveSupplierSubmissionOverrides,
} from "@/lib/services/supplier-submission";

export interface ApproveSupplierSubmissionActionResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  issues?: { formErrors: string[]; fieldErrors: Record<string, string[]> };
}

function toPlainJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

export async function approveSupplierSubmissionAction(
  submissionId: string,
  overrides: ApproveSupplierSubmissionOverrides = {}
): Promise<ApproveSupplierSubmissionActionResult> {
  try {
    const result = await approveSupplierSubmission(submissionId, "ADMIN", overrides);
    if (!result.ok) {
      return { ok: false, error: result.error, issues: "issues" in result ? result.issues : undefined };
    }
    return { ok: true, data: toPlainJson(result.data) };
  } catch (error) {
    console.error("approveSupplierSubmissionAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to approve supplier submission" };
  }
}
