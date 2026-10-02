/**
 * app/api/notifications/webhooks/route.ts
 * -----------------------------------------------------------------------
 * GET/POST /api/notifications/webhooks — Phase 7 - Step 1: Automated
 * Notification & Webhook Suite. List/create WebhookEndpoint rows.
 *
 * GET is public/unauthenticated (same reasoning as
 * GET /api/notifications/settings — see that route's banner) but never
 * returns `secret`: listWebhookEndpoints()'s return shape simply has no
 * such field, so there is no masking logic to get wrong. POST is
 * ADMIN-gated (creating an outbound integration endpoint is a real
 * mutation) and is the ONE response that ever includes the raw secret —
 * exactly once, at creation (see lib/services/webhook-endpoints.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { listWebhookEndpoints, createWebhookEndpoint } from "@/lib/services/webhook-endpoints";
import { authorizeApiRequest } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Access-control audit (2026-09-30): ADMIN only (session or API key).
  const auth = await authorizeApiRequest(req, ["ADMIN"]);
  if (!auth.ok) return auth.response;

  try {
    const data = await listWebhookEndpoints();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/notifications/webhooks failed:", error);
    return NextResponse.json({ success: false, error: "Failed to load webhook endpoints" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const role = authorize(req, ["ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Request body must be a JSON object" }, { status: 400 });
    }
    const result = await createWebhookEndpoint(role, body);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    console.error("POST /api/notifications/webhooks failed:", error);
    return NextResponse.json({ success: false, error: "Failed to create webhook endpoint" }, { status: 500 });
  }
}
