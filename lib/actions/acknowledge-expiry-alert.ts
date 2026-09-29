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
// Security (2026-09-29): admin-only Server Action. A Server Action is a
// public POST endpoint in its own right, so being mounted only under
// /admin is not a guard. Every export below re-verifies an active ADMIN
// session first (outside any try/catch, so requireAdminSession()'s
// redirect to /login propagates instead of being swallowed).
import { requireAdminSession } from "@/lib/session-auth";

export interface AcknowledgeExpiryAlertActionResult {
  ok: boolean;
  error?: string;
}

export async function acknowledgeExpiryAlertAction(
  certificationId: string
): Promise<AcknowledgeExpiryAlertActionResult> {
  await requireAdminSession();

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
