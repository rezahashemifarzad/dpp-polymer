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
// Security (2026-09-29): admin-only Server Action. A Server Action is a
// public POST endpoint in its own right, so being mounted only under
// /admin is not a guard. Every export below re-verifies an active ADMIN
// session first (outside any try/catch, so requireAdminSession()'s
// redirect to /login propagates instead of being swallowed).
import { requireAdminSession } from "@/lib/session-auth";

export interface CreateWebhookEndpointActionResult {
  ok: boolean;
  data?: WebhookEndpointSummary & { secret: string };
  error?: string;
}

export async function createWebhookEndpointAction(input: CreateWebhookEndpointInput): Promise<CreateWebhookEndpointActionResult> {
  await requireAdminSession();

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
