/**
 * app/api/certifications/expiry-check/route.ts
 * -----------------------------------------------------------------------
 * POST /api/certifications/expiry-check — Phase 4 - Step 1: Automated
 * Expiry & Compliance Alerts. The actual "background check": runs
 * lib/services/expiry-alert-service.ts's runExpiryAlertCheck, which
 * persists notification state and writes a CERT_EXPIRY_ALERT_RAISED
 * AuditLog entry for every certification whose expiry tier has newly
 * appeared or escalated since the last run.
 *
 * This is a WRITE — unlike GET /api/certifications/expiry-alerts (the
 * live read powering the dashboard widget), this route is meant to be
 * invoked on a schedule, not on every page load. Two ways in, exposed as
 * two different HTTP methods since Vercel Cron Jobs always issue a GET
 * request (there is no way to configure a different method in
 * vercel.json's `crons` entries):
 *
 *   - GET  — Vercel Cron only (see vercel.json). Vercel signs scheduled
 *     requests with `Authorization: Bearer ${CRON_SECRET}` when
 *     CRON_SECRET is set in the project's environment; required here, so
 *     a bare unauthenticated GET is always rejected.
 *   - POST — manual trigger from the admin UI or an external caller,
 *     gated to ADMIN via lib/rbac.ts's `x-dpp-api-key` header, same
 *     convention as every other admin-only mutation route in this app.
 *
 * Fails closed like lib/rbac.ts: if CRON_SECRET isn't configured, GET
 * always 401s rather than accepting an unauthenticated request.
 */

import { NextRequest, NextResponse } from "next/server";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { runExpiryAlertCheck } from "@/lib/services/expiry-alert-service";

function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

async function runCheck(actor: string) {
  const result = await runExpiryAlertCheck(actor);
  return NextResponse.json({ success: true, data: result });
}

/** Vercel Cron entry point only — see file banner. */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return unauthorizedResponse();
  }
  try {
    return await runCheck("SYSTEM:CRON");
  } catch (error) {
    console.error("GET /api/certifications/expiry-check (cron) failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to run the expiry alert check" },
      { status: 500 }
    );
  }
}

/** Manual trigger for the admin UI / external ADMIN-keyed callers. */
export async function POST(req: NextRequest) {
  const role = authorize(req, ["ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }
  try {
    return await runCheck(role);
  } catch (error) {
    console.error("POST /api/certifications/expiry-check failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to run the expiry alert check" },
      { status: 500 }
    );
  }
}
