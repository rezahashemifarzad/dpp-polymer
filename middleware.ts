/**
 * middleware.ts
 * -----------------------------------------------------------------------
 * Edge-safe FAST GATE for the new session-based portals
 * (/portal/auditor/*, /portal/customer/*) — Role-Based Authentication &
 * Client/Auditor Portal Suite. No middleware.ts existed anywhere in this
 * app before this file.
 *
 * This checks ONLY that the `dpp_session` cookie is present — it does NOT
 * verify the token, resolve it to a Session row, or check actorType. That
 * real check happens in lib/session-auth.ts's requireAuditorSession() /
 * requireClientSession(), called from each protected page itself.
 *
 * This is deliberate, not a shortcut: middleware here is a cheap first
 * filter that avoids rendering a portal shell for a visitor with no cookie
 * at all, not the actual security boundary. Treating middleware as the
 * sole auth boundary is exactly the pattern Vercel warned against after
 * CVE-2025-29927 (a middleware-only-authorization bypass) — the DB-backed
 * check inside each page is what actually protects the data, and would
 * still protect it even if this file were deleted entirely.
 *
 * Scoped ONLY to /portal/*. Deliberately does NOT touch:
 *   - /admin/* — already gated per-route via lib/rbac.ts's shared API key;
 *     out of scope for this pass (see the plan's ADMIN-login decision).
 *   - /auditor, /client-portal — the existing key-entry-gate pages, which
 *     have their own client-side auth flow and must keep working exactly
 *     as they do today.
 */

import { NextRequest, NextResponse } from "next/server";
// Import ONLY the tiny constants module here — never lib/session-auth.ts
// itself, which pulls in @/lib/prisma (not Edge-compatible). See
// lib/session-constants.ts's own file banner.
import { SESSION_COOKIE_NAME } from "@/lib/session-constants";

export function middleware(req: NextRequest) {
  const hasSessionCookie = Boolean(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!hasSessionCookie) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/portal/:path*"],
};
