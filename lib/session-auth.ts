/**
 * lib/session-auth.ts
 * -----------------------------------------------------------------------
 * Shared cookie-session helper for the Role-Based Authentication &
 * Client/Auditor Portal Suite — backs /login, /portal/auditor, and
 * /portal/customer.
 *
 * This is the "third actor type" extraction lib/client-auth.ts's own file
 * banner explicitly calls out as the trigger for a shared helper ("if a
 * third actor type shows up needing the same pattern, that's the trigger
 * to extract a shared helper — not before"). It applies to the NEW session
 * layer only: lib/auditor-auth.ts and lib/client-auth.ts's per-actor bearer
 * key modules stay exactly as they are, untouched and still duplicated,
 * since every existing route depends on their exact current behavior.
 *
 * Deliberately NOT the sole security boundary for /portal/*. proxy.ts
 * only checks cookie *presence* as a fast Edge-safe gate; the real check —
 * resolving the session, verifying actorType, and confirming the actor is
 * still active — happens here, called from each protected Server Component
 * page via requireAuditorSession()/requireClientSession(). Never treat
 * Next.js middleware as a sole auth boundary (see e.g. CVE-2025-29927) —
 * always re-verify where the sensitive data is actually read.
 */

import { randomBytes, createHash } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Auditor, Client, AdminUser, SessionActorType } from "@prisma/client";
import { SESSION_COOKIE_NAME } from "@/lib/session-constants";

export { SESSION_COOKIE_NAME };

// Fixed 12-hour lifetime, no sliding refresh — simplest correct behavior
// for this MVP. A user whose session expires mid-use is redirected back to
// /login by requireAuditorSession()/requireClientSession() and simply signs
// in again.
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function hashToken(rawToken: string): string {
  // SHA-256 over a 256-bit random token — mirrors Auditor.apiKeyHash /
  // Client.apiKeyHash exactly. Unlike lib/password.ts's scrypt (built for
  // low-entropy human-chosen input), a plain fast hash is correct here:
  // the input is already high-entropy and server-generated, so there is
  // nothing for a memory-hard KDF to protect against that a unique-index
  // lookup doesn't already make effectively free to search.
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

function generateRawToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Creates a new Session row for the given actor and returns the raw token
 * (never persisted) for the caller to set as the session cookie.
 */
export async function createSession(
  actorType: SessionActorType,
  actorId: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateRawToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: { tokenHash, actorType, actorId, expiresAt },
  });

  return { token, expiresAt };
}

/**
 * Sets the session cookie on the current response. Must be called from a
 * Server Action or Route Handler (anywhere next/headers' cookies() is
 * mutable), never from a plain Server Component render.
 */
export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export interface ResolvedSession {
  actorType: SessionActorType;
  actorId: string;
  expiresAt: Date;
}

/**
 * Reads the session cookie (if any), resolves it to a Session row, and
 * transparently deletes+returns null for an expired one. Returns null
 * (never throws) for: no cookie, unknown token, or expired session — all
 * three are "not signed in" from the caller's point of view.
 */
export async function getSession(): Promise<ResolvedSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({ where: { tokenHash } });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    // Best-effort cleanup of the now-expired row — a failure here (e.g. a
    // concurrent delete already removed it) shouldn't surface as an error
    // to the caller, who just needs to know "not signed in."
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return { actorType: session.actorType, actorId: session.actorId, expiresAt: session.expiresAt };
}

/**
 * Deletes the Session row for the current cookie (if any) and clears the
 * cookie. Only the current tab/device's session is removed — other
 * concurrent sessions for the same actor keep working, matching how the
 * legacy sessionStorage-based key gates never had a "sign out everywhere"
 * concept either.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const tokenHash = hashToken(token);
    await prisma.session.delete({ where: { tokenHash } }).catch(() => {});
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Resolves the current session to an active Auditor, or redirects to
 * /login. Call at the top of any Server Component page under
 * /portal/auditor. A session that resolves to the wrong actor type (e.g. a
 * CUSTOMER session hitting this portal) redirects to that actor's own
 * correct destination instead of throwing a 403 — a friendlier outcome for a
 * legitimate, currently-authenticated visitor who's just in the wrong
 * place.
 *
 * Each wrong-actor-type branch is now checked explicitly (AUDITOR, CUSTOMER,
 * ADMIN) rather than a single `!== "AUDITOR"` fallthrough. That fallthrough
 * was correct back when SessionActorType only had two values, but once
 * ADMIN was added (Production Readiness follow-up — Real Admin Login) it
 * would have sent an admin session hitting /portal/auditor to
 * /portal/customer, which would in turn bounce it right back here via
 * requireClientSession's own equivalent check — an infinite redirect loop.
 * Naming every actor type explicitly here avoids that class of bug for any
 * future fourth actor type too.
 */
export async function requireAuditorSession(): Promise<Auditor> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.actorType === "CUSTOMER") redirect("/portal/customer");
  if (session.actorType === "ADMIN") redirect("/admin");

  const auditor = await prisma.auditor.findUnique({ where: { id: session.actorId } });
  if (!auditor || !auditor.active) redirect("/login");

  return auditor;
}

/** Mirror of requireAuditorSession() for the CUSTOMER/Client actor type. */
export async function requireClientSession(): Promise<Client> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.actorType === "AUDITOR") redirect("/portal/auditor");
  if (session.actorType === "ADMIN") redirect("/admin");

  const client = await prisma.client.findUnique({ where: { id: session.actorId } });
  if (!client || !client.active) redirect("/login");

  return client;
}

/**
 * Mirror of requireAuditorSession()/requireClientSession() for the new
 * ADMIN actor type (Production Readiness follow-up — Real Admin Login &
 * Session Wall for /admin). Called from app/admin/layout.tsx, which wraps
 * every /admin/* route automatically, so there is no separate route to
 * forget to guard. Same three outcomes as the other two: no session ->
 * /login; a valid session for the wrong actor type -> that actor's own
 * destination (never a 403 — see the comment above); no matching/active
 * AdminUser row (e.g. a soft-revoked admin) -> /login.
 */
export async function requireAdminSession(): Promise<AdminUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.actorType === "AUDITOR") redirect("/portal/auditor");
  if (session.actorType === "CUSTOMER") redirect("/portal/customer");

  const admin = await prisma.adminUser.findUnique({ where: { id: session.actorId } });
  if (!admin || !admin.active) redirect("/login");

  return admin;
}

// ---------------------------------------------------------------------------
// Access-control audit (2026-09-30) — non-redirecting session resolution.
// ---------------------------------------------------------------------------

export type ViewerRole = "ADMIN" | "AUDITOR" | "CUSTOMER";

export interface SessionActor {
  role: ViewerRole;
  actorId: string;
  /** Human-readable identity for audit-log `actor` fields, e.g. "ADMIN:ops@example.com". */
  label: string;
}

/**
 * Resolves the current cookie session to an ACTIVE actor, or null. Unlike the
 * require*Session() helpers above it never redirects, so Route Handlers can
 * answer 401/403 JSON and Server Components can branch on the viewer's role
 * (e.g. render the Home console read-only for guests).
 *
 * A session whose actor row is missing or soft-revoked (active = false)
 * resolves to null — deactivating an account takes effect on its very next
 * request, not when its 12-hour session happens to expire.
 */
export async function getSessionActor(): Promise<SessionActor | null> {
  const session = await getSession();
  if (!session) return null;

  switch (session.actorType) {
    case "ADMIN": {
      const admin = await prisma.adminUser.findUnique({ where: { id: session.actorId } });
      return admin && admin.active ? { role: "ADMIN", actorId: admin.id, label: `ADMIN:${admin.email}` } : null;
    }
    case "AUDITOR": {
      const auditor = await prisma.auditor.findUnique({ where: { id: session.actorId } });
      return auditor && auditor.active
        ? { role: "AUDITOR", actorId: auditor.id, label: `AUDITOR:${auditor.email ?? auditor.id}` }
        : null;
    }
    case "CUSTOMER": {
      const client = await prisma.client.findUnique({ where: { id: session.actorId } });
      return client && client.active
        ? { role: "CUSTOMER", actorId: client.id, label: `CUSTOMER:${client.contactEmail ?? client.id}` }
        : null;
    }
    default:
      return null;
  }
}
