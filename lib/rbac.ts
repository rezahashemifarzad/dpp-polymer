/**
 * lib/rbac.ts
 * -----------------------------------------------------------------------
 * Interim service-key RBAC gate for state-changing passport actions
 * (verify / revoke).
 *
 * This is NOT the final auth system — it is a real, working access-control
 * boundary that every route calling it enforces today, standing in until
 * session-based auth (roles derived from a logged-in user) is wired in a
 * later step. Nothing here is a stub: a request without a valid key for an
 * allowed role is rejected with 401, full stop.
 *
 * Callers present their assigned key via the `x-dpp-api-key` header. Keys
 * are compared with a timing-safe comparison to avoid leaking key material
 * through response-time side channels.
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

export type DppRole = "MANUFACTURER" | "AUDITOR" | "ADMIN";

const ROLE_KEY_ENV: Record<DppRole, string> = {
  MANUFACTURER: "DPP_MANUFACTURER_API_KEY",
  AUDITOR: "DPP_AUDITOR_API_KEY",
  ADMIN: "DPP_ADMIN_API_KEY",
};

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Returns the matched role if the request presents a valid key for one of
 * `allowedRoles`, or null otherwise. Roles whose env var is unset are
 * treated as "not configured" and never match (fails closed, not open).
 */
export function authorize(req: NextRequest, allowedRoles: DppRole[]): DppRole | null {
  const presentedKey = req.headers.get("x-dpp-api-key");
  if (!presentedKey) return null;

  for (const role of allowedRoles) {
    const expectedKey = process.env[ROLE_KEY_ENV[role]];
    if (expectedKey && safeCompare(presentedKey, expectedKey)) {
      return role;
    }
  }
  return null;
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: "Unauthorized: a valid x-dpp-api-key header for an allowed role is required",
    },
    { status: 401 }
  );
}
