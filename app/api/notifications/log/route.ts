/**
 * app/api/notifications/log/route.ts
 * -----------------------------------------------------------------------
 * GET /api/notifications/log — Phase 7 - Step 1: Automated Notification &
 * Webhook Suite. Recent NotificationLog rows (delivery history across both
 * channels) for the admin panel. Public/unauthenticated, same convention
 * as GET /api/certifications/expiry-alerts and the other new
 * /api/notifications/* read routes — nothing returned here (title,
 * message, delivery status, endpoint URL) is more sensitive than what's
 * already visible elsewhere in this unauthenticated admin console.
 */

import { NextRequest, NextResponse } from "next/server";
import { getRecentNotificationLog } from "@/lib/services/notification-service";
import { authorizeApiRequest } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Access-control audit (2026-09-30): ADMIN only (session or API key).
  const auth = await authorizeApiRequest(req, ["ADMIN"]);
  if (!auth.ok) return auth.response;

  try {
    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;
    const data = await getRecentNotificationLog(limit && Number.isFinite(limit) ? limit : undefined);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/notifications/log failed:", error);
    return NextResponse.json({ success: false, error: "Failed to load notification log" }, { status: 500 });
  }
}
