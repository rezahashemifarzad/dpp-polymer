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
// Security (2026-09-29): admin-only Server Action. A Server Action is a
// public POST endpoint in its own right, so being mounted only under
// /admin is not a guard. Every export below re-verifies an active ADMIN
// session first (outside any try/catch, so requireAdminSession()'s
// redirect to /login propagates instead of being swallowed).
import { requireAdminSession } from "@/lib/session-auth";

export interface UpsertTaxParameterActionResult {
  ok: boolean;
  data?: TaxParameterSummary;
  error?: string;
}

export async function upsertTaxParameterAction(
  input: CreateTaxParameterInput
): Promise<UpsertTaxParameterActionResult> {
  await requireAdminSession();

  try {
    const data = await createTaxParameter(input);
    return { ok: true, data };
  } catch (error) {
    console.error("upsertTaxParameterAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to save tax parameter" };
  }
}
