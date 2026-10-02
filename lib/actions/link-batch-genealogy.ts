"use server";

/**
 * lib/actions/link-batch-genealogy.ts
 * -----------------------------------------------------------------------
 * Server Action backing the in-app admin "Manage Genealogy" UI (see
 * components/dashboard/batch-details-modal.tsx). Same reasoning as
 * lib/actions/create-passport.ts: runs entirely server-side via Next.js's
 * internal RPC, never a public URL, so it must never be given an RBAC key
 * — POST /api/passports/[batchId]/parents is the gated entry point for
 * external callers instead.
 */

import { linkBatchGenealogy, type LinkBatchGenealogyInput } from "@/lib/services/link-batch-genealogy";
import { requireAdminSession } from "@/lib/session-auth";

export interface LinkBatchGenealogyActionResult {
  ok: boolean;
  data?: { id: string; parentPassportId: string; childPassportId: string };
  error?: string;
}

export async function linkBatchGenealogyAction(
  childBatchId: string,
  input: LinkBatchGenealogyInput
): Promise<LinkBatchGenealogyActionResult> {
  // Access-control audit (2026-09-30): admin-only mutation/read. Called
  // OUTSIDE the try/catch so Next.js's redirect to /login propagates.
  await requireAdminSession();

  try {
    const result = await linkBatchGenealogy(childBatchId, input, "ADMIN");
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true, data: result.data };
  } catch (error) {
    console.error("linkBatchGenealogyAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to link parent batch" };
  }
}
