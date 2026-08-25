/**
 * app/api/notifications/webhooks/[id]/route.ts
 * -----------------------------------------------------------------------
 * PATCH/DELETE /api/notifications/webhooks/{id} — Phase 7 - Step 1:
 * Automated Notification & Webhook Suite. Update (URL, description,
 * subscribed event types, active toggle) or delete one WebhookEndpoint.
 * Both ADMIN-gated via lib/rbac.ts — same convention as every other
 * admin-only mutation route in this app.
 */

import { NextRequest, NextResponse } from "next/server";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { updateWebhookEndpoint, deleteWebhookEndpoint } from "@/lib/services/webhook-endpoints";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = authorize(req, ["ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }
  const { id } = await params;
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Request body must be a JSON object" }, { status: 400 });
    }
    const result = await updateWebhookEndpoint(id, body);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error(`PATCH /api/notifications/webhooks/${id} failed:`, error);
    return NextResponse.json({ success: false, error: "Failed to update webhook endpoint" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = authorize(req, ["ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }
  const { id } = await params;
  try {
    const result = await deleteWebhookEndpoint(id);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/notifications/webhooks/${id} failed:`, error);
    return NextResponse.json({ success: false, error: "Failed to delete webhook endpoint" }, { status: 500 });
  }
}
