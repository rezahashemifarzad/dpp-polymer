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

export interface UpdateNotificationSettingsActionResult {
  ok: boolean;
  data?: NotificationSettingsView;
  error?: string;
}

export async function updateNotificationSettingsAction(
  input: UpdateNotificationSettingsInput
): Promise<UpdateNotificationSettingsActionResult> {
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
