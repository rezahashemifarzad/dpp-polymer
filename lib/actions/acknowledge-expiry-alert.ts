"use server";

/**
 * lib/actions/acknowledge-expiry-alert.ts
 * -----------------------------------------------------------------------
 * Server Action backing the in-app admin Compliance Alerts widget's
 * "Acknowledge" button. Same reasoning as
 * lib/actions/save-green-valuation.ts: runs entirely server-side, never a
 * public URL, so it never needs an RBAC key — POST
 * /api/certifications/[id]/acknowledge-alert is the ADMIN-gated entry
 * point for external callers instead.
 */

import { acknowledgeExpiryAlert } from "@/lib/services/expiry-alert-service";

export interface AcknowledgeExpiryAlertActionResult {
  ok: boolean;
  error?: string;
}

export async function acknowledgeExpiryAlertAction(
  certificationId: string
): Promise<AcknowledgeExpiryAlertActionResult> {
  try {
    const result = await acknowledgeExpiryAlert(certificationId, "ADMIN");
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true };
  } catch (error) {
    console.error("acknowledgeExpiryAlertAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to acknowledge alert" };
  }
}
