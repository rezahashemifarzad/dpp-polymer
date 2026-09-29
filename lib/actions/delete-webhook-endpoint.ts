"use server";

/**
 * lib/actions/delete-webhook-endpoint.ts
 * -----------------------------------------------------------------------
 * Server Action backing the admin Notifications panel's per-endpoint
 * "Delete" control. Same in-app/RBAC-free convention as
 * lib/actions/create-webhook-endpoint.ts.
 */

import { deleteWebhookEndpoint } from "@/lib/services/webhook-endpoints";
// Security (2026-09-29): admin-only Server Action. A Server Action is a
// public POST endpoint in its own right, so being mounted only under
// /admin is not a guard. Every export below re-verifies an active ADMIN
// session first (outside any try/catch, so requireAdminSession()'s
// redirect to /login propagates instead of being swallowed).
import { requireAdminSession } from "@/lib/session-auth";

export interface DeleteWebhookEndpointActionResult {
  ok: boolean;
  error?: string;
}

export async function deleteWebhookEndpointAction(id: string): Promise<DeleteWebhookEndpointActionResult> {
  await requireAdminSession();

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
