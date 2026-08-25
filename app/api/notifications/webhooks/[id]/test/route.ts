/**
 * app/api/notifications/webhooks/[id]/test/route.ts
 * -----------------------------------------------------------------------
 * POST /api/notifications/webhooks/{id}/test — Phase 7 - Step 1: Automated
 * Notification & Webhook Suite. Sends a synthetic ping to one endpoint on
 * demand (lib/services/webhook-endpoints.ts's testWebhookEndpoint) so an
 * admin can verify connectivity right after adding a URL, without waiting
 * for a real compliance event. ADMIN-gated — this makes a real outbound
 * HTTP call to a third party, same care as any other admin mutation.
 */

import { NextRequest, NextResponse } from "next/server";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { testWebhookEndpoint } from "@/lib/services/webhook-endpoints";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = authorize(req, ["ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }
  const { id } = await params;
  try {
    const result = await testWebhookEndpoint(id);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error(`POST /api/notifications/webhooks/${id}/test failed:`, error);
    return NextResponse.json({ success: false, error: "Failed to send test webhook" }, { status: 500 });
  }
}
