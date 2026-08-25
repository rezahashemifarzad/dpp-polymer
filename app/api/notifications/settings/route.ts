/**
 * app/api/notifications/settings/route.ts
 * -----------------------------------------------------------------------
 * GET/PUT /api/notifications/settings — Phase 7 - Step 1: Automated
 * Notification & Webhook Suite.
 *
 * GET is public/unauthenticated, same convention as GET
 * /api/certifications/expiry-alerts — the admin console has no session
 * auth yet (see lib/rbac.ts's own "interim service-key gate" comment), so
 * gating a read-only settings view would only break the admin panel
 * without protecting anything genuinely secret (no webhook secret, no
 * credential, lives on this row — just thresholds/toggles/recipient
 * emails). PUT is ADMIN-gated via lib/rbac.ts, matching every other
 * admin-only mutation route in this app.
 */

import { NextRequest, NextResponse } from "next/server";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { getNotificationSettings, updateNotificationSettings } from "@/lib/services/notification-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getNotificationSettings();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/notifications/settings failed:", error);
    return NextResponse.json({ success: false, error: "Failed to load notification settings" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const role = authorize(req, ["ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Request body must be a JSON object" }, { status: 400 });
    }
    const result = await updateNotificationSettings(role, body);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error("PUT /api/notifications/settings failed:", error);
    return NextResponse.json({ success: false, error: "Failed to update notification settings" }, { status: 500 });
  }
}
