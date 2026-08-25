"use server";

/**
 * lib/actions/run-notification-sweep.ts
 * -----------------------------------------------------------------------
 * Server Action backing the admin Notifications panel's "Run Sweep Now"
 * button — a manual trigger for the same combined check that otherwise
 * runs on Vercel Cron's daily schedule (see vercel.json and
 * app/api/notifications/sweep/route.ts's GET handler). Same dual-path
 * reasoning as lib/actions/run-expiry-check.ts: this runs entirely
 * server-side and never needs an RBAC key; POST /api/notifications/sweep
 * is the ADMIN-gated entry point for external callers instead.
 */

import { runNotificationSweep, type NotificationSweepResult } from "@/lib/services/notification-service";

export interface RunNotificationSweepActionResult {
  ok: boolean;
  data?: NotificationSweepResult;
  error?: string;
}

export async function runNotificationSweepAction(): Promise<RunNotificationSweepActionResult> {
  try {
    const data = await runNotificationSweep("ADMIN");
    return { ok: true, data };
  } catch (error) {
    console.error("runNotificationSweepAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to run the notification sweep" };
  }
}
