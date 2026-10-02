/**
 * lib/api-auth.ts
 * -----------------------------------------------------------------------
 * Access-control audit (2026-09-30) — the single authorization gate for
 * Route Handlers under app/api/** that are called BOTH by the in-app UI
 * (a signed-in browser carrying the `dpp_session` cookie) and by external
 * machine callers (ERP, scripts, auditor tooling carrying an API key).
 *
 * A request is authorized when ANY of these resolves to an allowed role:
 *   1. a live cookie session (lib/session-auth.ts getSessionActor())
 *      — the actor must still exist and be active;
 *   2. a shared role key in `x-dpp-api-key` (lib/rbac.ts authorize())
 *      — fails closed when the role's env var is unset;
 *   3. for AUDITOR only, an individual auditor key in `x-dpp-auditor-key`
 *      (lib/auditor-auth.ts authorizeAuditor()) — must be active.
 *
 * Outcome:
 *   - no credential at all                     -> 401 Unauthorized
 *   - valid credential, role not allowed here  -> 403 Forbidden
 *   - allowed                                  -> the resolved principal
 *
 * lib/rbac.ts's synchronous authorize() is deliberately left untouched:
 * every existing key-only route keeps calling it exactly as before, and
 * making it async would silently turn `if (!role)` checks on a Promise into
 * an auth bypass. New or hardened routes call authorizeApiRequest() and must
 * `await` it.
 */

import { NextRequest, NextResponse } from "next/server";
import { authorize, type DppRole } from "@/lib/rbac";
import { authorizeAuditor } from "@/lib/auditor-auth";
import { getSessionActor } from "@/lib/session-auth";

export type ApiRole = "ADMIN" | "AUDITOR" | "MANUFACTURER";

export interface ApiPrincipal {
  role: ApiRole;
  via: "session" | "role-key" | "auditor-key";
  /** Value to record as the audit-log actor for anything this request writes. */
  actor: string;
}

export type ApiAuthResult =
  | { ok: true; principal: ApiPrincipal }
  | { ok: false; response: NextResponse };

export function apiUnauthorizedResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: "Unauthorized: sign in, or send a valid API key for a role allowed on this endpoint",
    },
    { status: 401, headers: { "Cache-Control": "no-store" } }
  );
}

export function apiForbiddenResponse(): NextResponse {
  return NextResponse.json(
    { success: false, error: "Forbidden: your role is not permitted to access this endpoint" },
    { status: 403, headers: { "Cache-Control": "no-store" } }
  );
}

/** Resolves the caller without deciding anything — null means anonymous. */
export async function resolveApiPrincipal(req: Request, allowed: ApiRole[]): Promise<{
  principal: ApiPrincipal | null;
  authenticatedButNotAllowed: boolean;
}> {
  let authenticatedButNotAllowed = false;

  // 1. Cookie session (in-app browser requests).
  const actor = await getSessionActor();
  if (actor) {
    if (actor.role !== "CUSTOMER" && allowed.includes(actor.role)) {
      return { principal: { role: actor.role, via: "session", actor: actor.label }, authenticatedButNotAllowed: false };
    }
    authenticatedButNotAllowed = true;
  }

  // 2. Shared role key (machine callers).
  const keyRoles = allowed.filter((r): r is DppRole => r === "ADMIN" || r === "AUDITOR" || r === "MANUFACTURER");
  const keyRole = authorize(req as NextRequest, keyRoles);
  if (keyRole) {
    return { principal: { role: keyRole, via: "role-key", actor: keyRole }, authenticatedButNotAllowed: false };
  }
  if (req.headers.get("x-dpp-api-key") && authorize(req as NextRequest, ["ADMIN", "AUDITOR", "MANUFACTURER"])) {
    authenticatedButNotAllowed = true;
  }

  // 3. Individual auditor key.
  if (allowed.includes("AUDITOR")) {
    const auditor = await authorizeAuditor(req);
    if (auditor) {
      return {
        principal: { role: "AUDITOR", via: "auditor-key", actor: `AUDITOR:${auditor.id}` },
        authenticatedButNotAllowed: false,
      };
    }
  }

  return { principal: null, authenticatedButNotAllowed };
}

/**
 * Gate for a Route Handler. Usage:
 *
 *   const auth = await authorizeApiRequest(req, ["ADMIN", "AUDITOR"]);
 *   if (!auth.ok) return auth.response;
 */
export async function authorizeApiRequest(req: Request, allowed: ApiRole[]): Promise<ApiAuthResult> {
  const { principal, authenticatedButNotAllowed } = await resolveApiPrincipal(req, allowed);
  if (principal) return { ok: true, principal };
  return { ok: false, response: authenticatedButNotAllowed ? apiForbiddenResponse() : apiUnauthorizedResponse() };
}
