"use server";

/**
 * lib/actions/run-expiry-check.ts
 * -----------------------------------------------------------------------
 * Server Action backing the in-app admin Compliance Alerts widget's
 * "Run Check Now" button — a manual trigger for the same background check
 * that otherwise runs on Vercel Cron's daily schedule (see vercel.json and
 * app/api/certifications/expiry-check/route.ts's GET handler). Same
 * dual-path reasoning as every other mutation in this app: this runs
 * entirely server-side and never needs an RBAC key; POST
 * /api/certifications/expiry-check is the ADMIN-gated entry point for
 * external callers instead.
 */

import { runExpiryAlertCheck, type ExpiryAlertCheckResult } from "@/lib/services/expiry-alert-service";
// Security (2026-09-29): admin-only Server Action. A Server Action is a
// public POST endpoint in its own right, so being mounted only under
// /admin is not a guard. Every export below re-verifies an active ADMIN
// session first (outside any try/catch, so requireAdminSession()'s
// redirect to /login propagates instead of being swallowed).
import { requireAdminSession } from "@/lib/session-auth";

export interface RunExpiryCheckActionResult {
  ok: boolean;
  data?: ExpiryAlertCheckResult;
  error?: string;
}

export async function runExpiryCheckAction(): Promise<RunExpiryCheckActionResult> {
  await requireAdminSession();

  try {
    const data = await runExpiryAlertCheck("ADMIN");
    return { ok: true, data };
  } catch (error) {
    console.error("runExpiryCheckAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to run the expiry alert check" };
  }
}
