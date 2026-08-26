/**
 * app/admin/layout.tsx
 * -----------------------------------------------------------------------
 * Server Component guard for every /admin/* route (Role-Based
 * Authentication & Client/Auditor Portal Suite — access-control fix).
 *
 * Next.js automatically wraps EVERY nested route under app/admin/** in
 * this layout — app/admin/page.tsx, app/admin/suppliers/page.tsx,
 * app/admin/notifications/page.tsx, app/admin/esg-analytics/page.tsx,
 * app/admin/green-accounting/page.tsx, app/admin/audit/page.tsx,
 * app/admin/generator/page.tsx, app/admin/search/page.tsx, and any future
 * /admin/* page — with zero risk of a new admin route shipping unguarded.
 *
 * What this fixes: /portal/auditor and /portal/customer's "Home" link
 * pointed at "/" — and "/" (app/page.tsx) is itself a full copy of the
 * internal Material Ledger admin console, not a neutral landing page.
 * Neither "/" nor "/admin" had ANY session check in front of them, so a
 * signed-in Auditor or Customer clicking Home landed straight in
 * administrative data. This layout closes that specifically for /admin:
 * a visitor carrying a valid AUDITOR or CUSTOMER session (lib/session-
 * auth.ts's getSession()) is redirected to their own portal before any
 * admin page under this tree renders or fetches data.
 *
 * Deliberately narrow scope — what this does NOT do:
 *   - It does not require login to reach /admin at all. Real ADMIN
 *     credential-based login was explicitly deferred when the Role-Based
 *     Auth suite was built (the admin console still relies on
 *     lib/rbac.ts's shared DPP_ADMIN_API_KEY header for state-changing
 *     API calls). A visitor with NO session cookie — anonymous, or a
 *     future logged-in admin — passes through unchanged, exactly as
 *     today. Adding a hard login wall for /admin is a bigger, separate
 *     decision (a real AdminUser + admin session) and out of scope for
 *     this fix; flagging it explicitly rather than quietly expanding
 *     scope.
 *   - It does not touch middleware.ts. That file's own banner already
 *     documents why middleware is a fast Edge-safe cookie-presence check,
 *     never the real security boundary (see its CVE-2025-29927 note) —
 *     the DB-backed actorType check belongs here, in a Server Component
 *     that can safely import lib/session-auth.ts (which pulls in
 *     @/lib/prisma, not Edge-compatible). middleware.ts's matcher stays
 *     scoped to /portal/:path* only; its comment claiming /admin/* was
 *     "already gated per-route via lib/rbac.ts" has been corrected there
 *     to point at this layout instead, since that claim was only ever
 *     true for specific mutation routes, never for page access.
 */

import { getSession } from "@/lib/session-auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (session?.actorType === "AUDITOR") {
    redirect("/portal/auditor");
  }
  if (session?.actorType === "CUSTOMER") {
    redirect("/portal/customer");
  }

  return <>{children}</>;
}
