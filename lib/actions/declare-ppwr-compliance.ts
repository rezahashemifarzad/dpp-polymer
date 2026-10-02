"use server";

/**
 * lib/actions/declare-ppwr-compliance.ts
 * -----------------------------------------------------------------------
 * Server Action backing the in-app admin "PPWR Compliance" panel (see
 * components/dashboard/reach-ppwr/reach-ppwr-panel.tsx). Same reasoning as
 * lib/actions/declare-svhc-status.ts — runs server-side only, never needs
 * the RBAC key that PATCH /api/passports/[batchId]/ppwr requires for
 * external callers.
 */

import { declarePpwrCompliance } from "@/lib/services/declare-ppwr-compliance";
import { requireAdminSession } from "@/lib/session-auth";

export interface DeclarePpwrComplianceActionResult {
  ok: boolean;
  data?: {
    ppwrRecyclabilityGrade: string | null;
    ppwrPfasCompliant: boolean | null;
    ppwrPfasConcentrationPpb: string | null;
    ppwrAssessedAt: Date;
    ppwrAssessedBy: string;
  };
  error?: string;
  issues?: { formErrors: string[]; fieldErrors: Record<string, string[]> };
}

export async function declarePpwrComplianceAction(
  batchId: string,
  input: unknown
): Promise<DeclarePpwrComplianceActionResult> {
  // Access-control audit (2026-09-30): admin-only mutation/read. Called
  // OUTSIDE the try/catch so Next.js's redirect to /login propagates.
  await requireAdminSession();

  try {
    const result = await declarePpwrCompliance(batchId, input, "ADMIN");
    if (!result.ok) {
      return { ok: false, error: result.error, ...("issues" in result ? { issues: result.issues } : {}) };
    }
    return { ok: true, data: result.data };
  } catch (error) {
    console.error("declarePpwrComplianceAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to declare PPWR compliance" };
  }
}
