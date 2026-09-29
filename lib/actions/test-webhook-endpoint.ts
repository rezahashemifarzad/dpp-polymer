"use server";

/**
 * lib/actions/test-webhook-endpoint.ts
 * -----------------------------------------------------------------------
 * Server Action backing the admin Notifications panel's per-endpoint
 * "Send Test" control. Same in-app/RBAC-free convention as
 * lib/actions/create-webhook-endpoint.ts.
 */

import { testWebhookEndpoint } from "@/lib/services/webhook-endpoints";
// Security (2026-09-29): admin-only Server Action. A Server Action is a
// public POST endpoint in its own right, so being mounted only under
// /admin is not a guard. Every export below re-verifies an active ADMIN
// session first (outside any try/catch, so requireAdminSession()'s
// redirect to /login propagates instead of being swallowed).
import { requireAdminSession } from "@/lib/session-auth";

export interface TestWebhookEndpointActionResult {
  ok: boolean;
  data?: { delivered: boolean; responseCode: number | null; error: string | null };
  error?: string;
}

export async function testWebhookEndpointAction(id: string): Promise<TestWebhookEndpointActionResult> {
  await requireAdminSession();

  try {
    const result = await testWebhookEndpoint(id);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true, data: result.data };
  } catch (error) {
    console.error("testWebhookEndpointAction failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Failed to send test webhook" };
  }
}
