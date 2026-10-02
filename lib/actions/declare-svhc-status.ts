"use server";

/**
 * lib/actions/declare-svhc-status.ts
 * -----------------------------------------------------------------------
 * Server Action backing the in-app admin "REACH Article 33 — SVHC
 * Declaration" panel (see components/dashboard/reach-ppwr/reach-ppwr-panel.tsx,
 * rendered inside components/dashboard/batch-details-modal.tsx). Same
 * reasoning as every other Server Action in lib/actions/: runs entirely
 * server-side via Next.js's internal RPC, never a public URL, so it must
 * never be given an RBAC key — PATCH /api/passports/[batchId]/svhc is the
 * gated entry point for external callers (an ERP, a lab's own system)
 * instead.
 */

import { declareSvhcStatus } from "@/lib/services/declare-svhc-status";
import { requireAdminSession } from "@/lib/session-auth";

export interface DeclareSvhcStatusActionResult {
  ok: boolean;
  data?: { svhcStatus: string; svhcStatusDeclaredAt: Date; svhcStatusDeclaredBy: string; substanceCount: number };
  error?: string;
  issues?: { formErrors: string[]; fieldErrors: Record<string, string[]> };
}

export async function declareSvhcStatusAction(
  batchId: string,
  input: unknown
): Promise<DeclareSvhcStatusActionResult> {
  // Access-control audit (2026-09-30): admin-only mutation/read. Called
  // OUTSIDE the try/catch so Next.js's redirect to /login propagates.
  await requireAdminSession();

  try {
    const result = await declareSvhcStatus(batchId, input, "ADMIN");
    if (!result.ok) {
      return { ok: false, error: result.error, ...("issues" in result ? { issues: result.issues } : {}) };
    }
    return { ok: true, data: result.data };
  } catch (error) {
    console.error("declareSvhcStatusAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to declare SVHC status" };
  }
}
