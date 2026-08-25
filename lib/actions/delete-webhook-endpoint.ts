"use server";

/**
 * lib/actions/delete-webhook-endpoint.ts
 * -----------------------------------------------------------------------
 * Server Action backing the admin Notifications panel's per-endpoint
 * "Delete" control. Same in-app/RBAC-free convention as
 * lib/actions/create-webhook-endpoint.ts.
 */

import { deleteWebhookEndpoint } from "@/lib/services/webhook-endpoints";

export interface DeleteWebhookEndpointActionResult {
  ok: boolean;
  error?: string;
}

export async function deleteWebhookEndpointAction(id: string): Promise<DeleteWebhookEndpointActionResult> {
  try {
    const result = await deleteWebhookEndpoint(id);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true };
  } catch (error) {
    console.error("deleteWebhookEndpointAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to delete webhook endpoint" };
  }
}
