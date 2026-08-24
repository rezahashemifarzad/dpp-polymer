"use server";

/**
 * lib/actions/add-chain-of-custody-record.ts
 * -----------------------------------------------------------------------
 * Server Action backing the in-app admin "Multi-Tier Chain of Custody"
 * panel (see components/dashboard/batch-details-modal.tsx). Same reasoning
 * as lib/actions/link-batch-genealogy.ts: runs entirely server-side via
 * Next.js's internal RPC, never a public URL, so it must never be given an
 * RBAC key — POST /api/passports/[batchId]/chain-of-custody is the gated
 * entry point for external callers instead.
 */

import { addChainOfCustodyRecord } from "@/lib/services/add-chain-of-custody-record";

export interface AddChainOfCustodyRecordActionResult {
  ok: boolean;
  data?: { id: string; passportId: string; sequence: number };
  error?: string;
  issues?: { formErrors: string[]; fieldErrors: Record<string, string[]> };
}

export async function addChainOfCustodyRecordAction(
  batchId: string,
  input: unknown
): Promise<AddChainOfCustodyRecordActionResult> {
  try {
    const result = await addChainOfCustodyRecord(batchId, input, "ADMIN");
    if (!result.ok) {
      return { ok: false, error: result.error, ...("issues" in result ? { issues: result.issues } : {}) };
    }
    return { ok: true, data: result.data };
  } catch (error) {
    console.error("addChainOfCustodyRecordAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to add chain-of-custody record" };
  }
}
