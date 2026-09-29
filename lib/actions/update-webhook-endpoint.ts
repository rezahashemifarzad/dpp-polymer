"use server";

/**
 * lib/actions/update-webhook-endpoint.ts
 * -----------------------------------------------------------------------
 * Server Action backing the admin Notifications panel's per-endpoint
 * edit/active-toggle controls. Same in-app/RBAC-free convention as
 * lib/actions/create-webhook-endpoint.ts.
 */

import { updateWebhookEndpoint, type WebhookEndpointSummary, type UpdateWebhookEndpointInput } from "@/lib/services/webhook-endpoints";
// Security (2026-09-29): admin-only Server Action. A Server Action is a
// public POST endpoint in its own right, so being mounted only under
// /admin is not a guard. Every export below re-verifies an active ADMIN
// session first (outside any try/catch, so requireAdminSession()'s
// redirect to /login propagates instead of being swallowed).
import { requireAdminSession } from "@/lib/session-auth";

export interface UpdateWebhookEndpointActionResult {
  ok: boolean;
  data?: WebhookEndpointSummary;
  error?: string;
}

export async function updateWebhookEndpointAction(id: string, input: UpdateWebhookEndpointInput): Promise<UpdateWebhookEndpointActionResult> {
  await requireAdminSession();

  try {
    const result = await updateWebhookEndpoint(id, input);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true, data: result.data };
  } catch (error) {
    console.error("updateWebhookEndpointAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to update webhook endpoint" };
  }
}
