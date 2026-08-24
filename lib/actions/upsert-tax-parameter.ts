"use server";

/**
 * lib/actions/upsert-tax-parameter.ts
 * -----------------------------------------------------------------------
 * Server Action backing the in-app admin Green Accounting "Tax Parameter"
 * settings panel. Same reasoning as the rest of this app's Server Action
 * layer: runs entirely server-side, never a public URL — POST
 * /api/green-accounting/tax-parameters is the ADMIN-gated entry point for
 * external callers instead.
 */

import {
  createTaxParameter,
  type CreateTaxParameterInput,
  type TaxParameterSummary,
} from "@/lib/services/plastic-tax-calculator";

export interface UpsertTaxParameterActionResult {
  ok: boolean;
  data?: TaxParameterSummary;
  error?: string;
}

export async function upsertTaxParameterAction(
  input: CreateTaxParameterInput
): Promise<UpsertTaxParameterActionResult> {
  try {
    const data = await createTaxParameter(input);
    return { ok: true, data };
  } catch (error) {
    console.error("upsertTaxParameterAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to save tax parameter" };
  }
}
