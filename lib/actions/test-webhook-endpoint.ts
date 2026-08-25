"use server";

/**
 * lib/actions/test-webhook-endpoint.ts
 * -----------------------------------------------------------------------
 * Server Action backing the admin Notifications panel's per-endpoint
 * "Send Test" control. Same in-app/RBAC-free convention as
 * lib/actions/create-webhook-endpoint.ts.
 */

import { testWebhookEndpoint } from "@/lib/services/webhook-endpoints";

export interface TestWebhookEndpointActionResult {
  ok: boolean;
  data?: { delivered: boolean; responseCode: number | null; error: string | null };
  error?: string;
}

export async function testWebhookEndpointAction(id: string): Promise<TestWebhookEndpointActionResult> {
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
