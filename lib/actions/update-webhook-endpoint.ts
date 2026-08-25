"use server";

/**
 * lib/actions/update-webhook-endpoint.ts
 * -----------------------------------------------------------------------
 * Server Action backing the admin Notifications panel's per-endpoint
 * edit/active-toggle controls. Same in-app/RBAC-free convention as
 * lib/actions/create-webhook-endpoint.ts.
 */

import { updateWebhookEndpoint, type WebhookEndpointSummary, type UpdateWebhookEndpointInput } from "@/lib/services/webhook-endpoints";

export interface UpdateWebhookEndpointActionResult {
  ok: boolean;
  data?: WebhookEndpointSummary;
  error?: string;
}

export async function updateWebhookEndpointAction(id: string, input: UpdateWebhookEndpointInput): Promise<UpdateWebhookEndpointActionResult> {
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
