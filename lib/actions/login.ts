"use server";

/**
 * lib/actions/login.ts
 * -----------------------------------------------------------------------
 * Server Action backing app/login/LoginForm.tsx — credential-based sign-in
 * for the ADMIN, AUDITOR, and CUSTOMER roles (Role-Based Authentication &
 * Client/Auditor Portal Suite, extended by the Production Readiness
 * follow-up — Real Admin Login & Session Wall for /admin). ADMIN login was
 * originally deferred; it's added here as a third lookup rather than a
 * separate action/page, since every other part of this flow (the form, the
 * session cookie, the "no password set" messaging) is already role-agnostic.
 *
 * Deliberately a Server Action, not a REST route: Server Actions get
 * Next.js's built-in same-origin verification for free, which this app has
 * no other CSRF protection for anywhere — and no external caller needs to
 * log a human in via curl, so there's nothing a dedicated REST route would
 * add here (see lib/actions/ask-assistant.ts's own file banner for the
 * same "no REST counterpart needed" reasoning applied elsewhere).
 *
 * Lookup order: try AdminUser by `email` first, then Auditor by `email`,
 * then Client by `contactEmail`. All three are admin/CLI-provisioned
 * populations (no open self-signup), so a theoretical email collision
 * across tables is treated as acceptable, documented behavior rather than
 * something worth enforcing uniqueness across at the database level —
 * AdminUser is checked first only so an operator's own email intentionally
 * takes precedence in the unlikely event of a collision.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword, dummyVerifyDelay } from "@/lib/password";
import { createSession, setSessionCookie } from "@/lib/session-auth";
import { redirect } from "next/navigation";

const LoginInputSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export interface LoginActionResult {
  ok: boolean;
  error?: string;
}

export async function loginAction(formData: FormData): Promise<LoginActionResult> {
  const parsed = LoginInputSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { email, password } = parsed.data;

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  const auditor = admin ? null : await prisma.auditor.findUnique({ where: { email } });
  const client = admin || auditor ? null : await prisma.client.findUnique({ where: { contactEmail: email } });

  const actor = admin ?? auditor ?? client;
  if (!actor) {
    // No matching account at all — still pay the scrypt cost so this
    // branch isn't measurably faster than a real verification, which
    // would otherwise let response timing distinguish "unknown email"
    // from "wrong password."
    await dummyVerifyDelay();
    return { ok: false, error: "Invalid email or password." };
  }

  if (!actor.active) {
    // Soft-revoked account — same message as "not found" so a deactivated
    // account isn't distinguishable from a nonexistent one.
    await dummyVerifyDelay();
    return { ok: false, error: "Invalid email or password." };
  }

  if (!actor.passwordHash) {
    // Per the confirmed UX decision: this is an admin-provisioned B2B/
    // auditor population, not open self-signup, so a specific message here
    // is a reasonable, low-risk trade-off in exchange for clearer guidance
    // during rollout (most accounts won't have a password yet).
    return { ok: false, error: "No password has been set for this account yet — contact your administrator." };
  }

  const valid = await verifyPassword(password, actor.passwordHash);
  if (!valid) {
    return { ok: false, error: "Invalid email or password." };
  }

  const actorType = admin ? "ADMIN" : auditor ? "AUDITOR" : "CUSTOMER";
  const { token, expiresAt } = await createSession(actorType, actor.id);
  await setSessionCookie(token, expiresAt);

  redirect(actorType === "ADMIN" ? "/admin" : actorType === "AUDITOR" ? "/portal/auditor" : "/portal/customer");
}
