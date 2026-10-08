/**
 * middleware.ts
 * -----------------------------------------------------------------------
 * Edge-safe FAST GATE for every session-based surface — /portal/auditor/*,
 * /portal/customer/* (Role-Based Authentication & Client/Auditor Portal
 * Suite), and /admin/* (added by the Production Readiness follow-up — Real
 * Admin Login & Session Wall for /admin). No middleware.ts existed anywhere
 * in this app before the portal suite added this file.
 *
 * This checks ONLY that the `dpp_session` cookie is present — it does NOT
 * verify the token, resolve it to a Session row, or check actorType. That
 * real check happens in lib/session-auth.ts's requireAuditorSession() /
 * requireClientSession() / requireAdminSession(), called from each
 * protected page (or, for /admin, from app/admin/layout.tsx, which wraps
 * every /admin/* route automatically) itself.
 *
 * This is deliberate, not a shortcut: middleware here is a cheap first
 * filter that avoids rendering a page shell for a visitor with no cookie
 * at all, not the actual security boundary. Treating middleware as the
 * sole auth boundary is exactly the pattern Vercel warned against after
 * CVE-2025-29927 (a middleware-only-authorization bypass) — the DB-backed
 * check inside each page/layout is what actually protects the data, and
 * would still protect it even if this file were deleted entirely: an
 * anonymous visitor hitting /admin directly with no cookie at all skips
 * this redirect (Next.js's own routing sends them straight to the page),
 * and app/admin/layout.tsx's requireAdminSession() catches that case just
 * the same.
 *
 * Adding /admin/:path* here is purely a UX nicety layered on top of an
 * already-real check, not what makes /admin safe — it just gives a visitor
 * with an expired/missing cookie a redirect straight to /login (with a
 * `next=` param back to where they were headed) instead of a page-level
 * redirect after a wasted render.
 *
 * Deliberately still does NOT touch /auditor or /client-portal — the
 * existing key-entry-gate pages, which have their own client-side auth
 * flow and must keep working exactly as they do today.
 */

import { NextRequest, NextResponse } from "next/server";
// Import ONLY the tiny constants module here — never lib/session-auth.ts
// itself, which pulls in @/lib/prisma (not Edge-compatible). See
// lib/session-constants.ts's own file banner.
import { SESSION_COOKIE_NAME } from "@/lib/session-constants";

export function middleware(req: NextRequest) {
  // Corporate landing page vs platform (2026-10-08): "/" is the public
  // company website. When the same deployment is also served on an "app."
  // subdomain (e.g. app.dpp-polymer.de, added as a domain in Vercel), that
  // host's root opens the platform at /app instead. No auth check here —
  // /app is publicly readable and decides admin controls server-side.
  if (req.nextUrl.pathname === "/") {
    const host = req.headers.get("host") ?? "";
    if (host.startsWith("app.")) {
      return NextResponse.rewrite(new URL("/app", req.url));
    }
    return NextResponse.next();
  }

  const hasSessionCookie = Boolean(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!hasSessionCookie) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/portal/:path*", "/admin/:path*"],
};
