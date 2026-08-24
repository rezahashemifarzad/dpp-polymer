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

export interface RunExpiryCheckActionResult {
  ok: boolean;
  data?: ExpiryAlertCheckResult;
  error?: string;
}

export async function runExpiryCheckAction(): Promise<RunExpiryCheckActionResult> {
  try {
    const data = await runExpiryAlertCheck("ADMIN");
    return { ok: true, data };
  } catch (error) {
    console.error("runExpiryCheckAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to run the expiry alert check" };
  }
}
