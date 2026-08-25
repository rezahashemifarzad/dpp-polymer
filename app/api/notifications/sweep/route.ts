/**
 * app/api/notifications/sweep/route.ts
 * -----------------------------------------------------------------------
 * POST/GET /api/notifications/sweep — Phase 7 - Step 1: Automated
 * Notification & Webhook Suite. Runs lib/services/notification-service.ts's
 * runNotificationSweep: the existing certificate-expiry background check
 * (unchanged — see that service's own file banner), then dispatches
 * notifications for anything it just raised, then sweeps newly-flagged
 * chain-of-custody anomalies.
 *
 * Same GET(cron)/POST(admin) dual-path convention as the pre-existing
 * POST /api/certifications/expiry-check (see that route's own banner for
 * the full reasoning — Vercel Cron only ever issues GET, so the
 * CRON_SECRET-gated path has to be GET; a human/admin trigger is POST,
 * gated by lib/rbac.ts's ADMIN key).
 *
 * vercel.json's single cron entry now points here instead of directly at
 * /api/certifications/expiry-check — that route remains fully intact and
 * independently callable (its own GET/POST both still work exactly as
 * before), it is simply no longer the one Vercel invokes on a schedule,
 * since this route already calls it internally as its first step. This
 * keeps exactly one scheduled cron entry (Vercel's Hobby-tier limit),
 * rather than risking a deploy failure by registering a second one.
 */

import { NextRequest, NextResponse } from "next/server";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { runNotificationSweep } from "@/lib/services/notification-service";

function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

async function runSweep(actor: string) {
  const result = await runNotificationSweep(actor);
  return NextResponse.json({ success: true, data: result });
}

/** Vercel Cron entry point only — see file banner. */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return unauthorizedResponse();
  }
  try {
    return await runSweep("SYSTEM:CRON");
  } catch (error) {
    console.error("GET /api/notifications/sweep (cron) failed:", error);
    return NextResponse.json({ success: false, error: "Failed to run the notification sweep" }, { status: 500 });
  }
}

/** Manual trigger for the admin UI / external ADMIN-keyed callers. */
export async function POST(req: NextRequest) {
  const role = authorize(req, ["ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }
  try {
    return await runSweep(role);
  } catch (error) {
    console.error("POST /api/notifications/sweep failed:", error);
    return NextResponse.json({ success: false, error: "Failed to run the notification sweep" }, { status: 500 });
  }
}
