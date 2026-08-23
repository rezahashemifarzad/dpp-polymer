"use server";

/**
 * lib/actions/calculate-carbon-footprint.ts
 * -----------------------------------------------------------------------
 * Server Action backing the in-app admin "Carbon Footprint" panel (see
 * components/dashboard/batch-details-modal.tsx). Same reasoning as
 * lib/actions/create-passport.ts: runs entirely server-side, never a
 * public URL, so it never needs an RBAC key — POST
 * /api/passports/[batchId]/carbon-footprint is the gated entry point for
 * external callers instead.
 */

import {
  calculateAndPersistCarbonFootprint,
  type CalculateCarbonFootprintInput,
} from "@/lib/services/calculate-carbon-footprint";

export interface CalculateCarbonFootprintActionResult {
  ok: boolean;
  data?: {
    scope1KgCO2e: number;
    scope2KgCO2e: number;
    scope3KgCO2e: number;
    totalKgCO2e: number;
    emissionFactorVersion: string;
  };
  error?: string;
}

export async function calculateCarbonFootprintAction(
  batchId: string,
  input: CalculateCarbonFootprintInput
): Promise<CalculateCarbonFootprintActionResult> {
  try {
    const result = await calculateAndPersistCarbonFootprint(batchId, input, "ADMIN");
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true, data: result.data };
  } catch (error) {
    console.error("calculateCarbonFootprintAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to calculate carbon footprint" };
  }
}
