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

export interface SaveGreenValuationActionResult {
  ok: boolean;
  data?: BatchGreenAccountingResult;
  error?: string;
}

export async function saveGreenValuationAction(
  batchId: string,
  jurisdiction?: string
): Promise<SaveGreenValuationActionResult> {
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
