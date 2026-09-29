"use server";

/**
 * lib/actions/save-green-valuation.ts
 * -----------------------------------------------------------------------
 * Server Action backing the in-app admin "Green Accounting" panel. Same
 * reasoning as lib/actions/calculate-carbon-footprint.ts: runs entirely
 * server-side, never a public URL, so it never needs an RBAC key — POST
 * /api/passports/[batchId]/green-valuation is the ADMIN-gated entry point
 * for external callers instead.
 */

import {
  saveBatchGreenValuation,
  type BatchGreenAccountingResult,
} from "@/lib/services/plastic-tax-calculator";
// Security (2026-09-29): admin-only Server Action. A Server Action is a
// public POST endpoint in its own right, so being mounted only under
// /admin is not a guard. Every export below re-verifies an active ADMIN
// session first (outside any try/catch, so requireAdminSession()'s
// redirect to /login propagates instead of being swallowed).
import { requireAdminSession } from "@/lib/session-auth";

export interface SaveGreenValuationActionResult {
  ok: boolean;
  data?: BatchGreenAccountingResult;
  error?: string;
}

export async function saveGreenValuationAction(
  batchId: string,
  jurisdiction?: string
): Promise<SaveGreenValuationActionResult> {
  await requireAdminSession();

  try {
    const result = await saveBatchGreenValuation(batchId, "ADMIN", jurisdiction);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true, data: result.data };
  } catch (error) {
    console.error("saveGreenValuationAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to save green valuation" };
  }
}
