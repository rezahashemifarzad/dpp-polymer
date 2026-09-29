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
// Security (2026-09-29): admin-only Server Action. A Server Action is a
// public POST endpoint in its own right, so being mounted only under
// /admin is not a guard. Every export below re-verifies an active ADMIN
// session first (outside any try/catch, so requireAdminSession()'s
// redirect to /login propagates instead of being swallowed).
import { requireAdminSession } from "@/lib/session-auth";

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
  await requireAdminSession();

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
