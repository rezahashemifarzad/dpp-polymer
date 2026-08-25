"use server";

/**
 * lib/actions/create-webhook-endpoint.ts
 * -----------------------------------------------------------------------
 * Server Action backing the admin Notifications panel's "Add Webhook"
 * form. Same in-app/RBAC-free convention as every other create action in
 * this app (e.g. lib/actions/create-supplier-invite.ts) — POST
 * /api/notifications/webhooks is the ADMIN-gated entry point for external
 * callers instead.
 */

import { createWebhookEndpoint, type WebhookEndpointSummary, type CreateWebhookEndpointInput } from "@/lib/services/webhook-endpoints";

export interface CreateWebhookEndpointActionResult {
  ok: boolean;
  data?: WebhookEndpointSummary & { secret: string };
  error?: string;
}

export async function createWebhookEndpointAction(input: CreateWebhookEndpointInput): Promise<CreateWebhookEndpointActionResult> {
  try {
    const result = await createWebhookEndpoint("ADMIN", input);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true, data: result.data };
  } catch (error) {
    console.error("createWebhookEndpointAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to create webhook endpoint" };
  }
}
