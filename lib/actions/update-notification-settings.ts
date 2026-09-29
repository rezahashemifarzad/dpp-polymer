"use server";

/**
 * lib/actions/update-notification-settings.ts
 * -----------------------------------------------------------------------
 * Server Action backing the admin Notifications panel's settings form
 * (email toggle/recipients, notify-on-tiers, anomaly toggle). Same
 * in-app/RBAC-free convention as lib/actions/create-webhook-endpoint.ts —
 * PUT /api/notifications/settings is the ADMIN-gated entry point for
 * external callers instead.
 */

import {
  updateNotificationSettings,
  type NotificationSettingsView,
  type UpdateNotificationSettingsInput,
} from "@/lib/services/notification-settings";
// Security (2026-09-29): admin-only Server Action. A Server Action is a
// public POST endpoint in its own right, so being mounted only under
// /admin is not a guard. Every export below re-verifies an active ADMIN
// session first (outside any try/catch, so requireAdminSession()'s
// redirect to /login propagates instead of being swallowed).
import { requireAdminSession } from "@/lib/session-auth";

export interface UpdateNotificationSettingsActionResult {
  ok: boolean;
  data?: NotificationSettingsView;
  error?: string;
}

export async function updateNotificationSettingsAction(
  input: UpdateNotificationSettingsInput
): Promise<UpdateNotificationSettingsActionResult> {
  await requireAdminSession();

  try {
    const result = await updateNotificationSettings("ADMIN", input);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true, data: result.data };
  } catch (error) {
    console.error("updateNotificationSettingsAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to update notification settings" };
  }
}
