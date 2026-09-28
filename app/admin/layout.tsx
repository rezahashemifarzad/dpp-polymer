/**
 * app/admin/layout.tsx
 * -----------------------------------------------------------------------
 * Server Component guard for every /admin/* route. Originally (Role-Based
 * Authentication & Client/Auditor Portal Suite — access-control fix) this
 * only redirected an already-signed-in Auditor/Customer away from /admin;
 * a fully anonymous visitor passed straight through, since real ADMIN
 * credential login didn't exist yet. Production Readiness follow-up — Real
 * Admin Login & Session Wall for /admin — closes that: this layout now
 * requires a valid, active ADMIN session outright via
 * requireAdminSession(), which redirects to /login (no session, or an
 * inactive/deleted admin), or to the visitor's own portal (a valid but
 * wrong-role AUDITOR/CUSTOMER session) — see lib/session-auth.ts's own
 * comment for why every actor type is now branched on explicitly rather
 * than an implicit fallthrough.
 *
 * Next.js automatically wraps EVERY nested route under app/admin/** in
 * this layout — app/admin/page.tsx, app/admin/accounts/page.tsx,
 * app/admin/suppliers/page.tsx, app/admin/notifications/page.tsx,
 * app/admin/esg-analytics/page.tsx, app/admin/green-accounting/page.tsx,
 * app/admin/audit/page.tsx, app/admin/generator/page.tsx,
 * app/admin/search/page.tsx, and any future /admin/* page — with zero risk
 * of a new admin route shipping unguarded.
 *
 * Deliberately narrow scope — what this does NOT do:
 *   - It does not touch lib/rbac.ts's DPP_ADMIN_API_KEY gate. That's a
 *     separate, still-working concern for machine/API callers (ERP
 *     integrations, scripts) hitting specific state-changing routes with an
 *     x-dpp-api-key header — untouched per the Baseline Rule.
 *   - It does not add an "invite" or self-service admin signup flow.
 *     AdminUser rows are provisioned via scripts/create-admin.ts only,
 *     matching how Auditor/Client accounts are CLI-provisioned (the new
 *     Accounts admin UI manages Auditor/Client, not AdminUser — deliberately
 *     out of scope here to keep this fix lightweight, per the request).
 *   - It does not touch middleware.ts's real security boundary — that
 *     stays the DB-backed check here (see lib/session-auth.ts's own
 *     CVE-2025-29927 note on why middleware is only ever a fast, non-
 *     authoritative first filter). middleware.ts's matcher was extended to
 *     also cover /admin/:path* for a fast cookie-presence redirect with a
 *     friendly `next=` param, purely as a UX nicety layered on top of this
 *     real check — see that file's own comment.
 *
 * Renders a minimal "Signed in as ... / Sign Out" bar above every admin
 * page rather than touching components/SiteNav.tsx (a shared client
 * component with no session awareness today) or any individual admin
 * page's own header — the smallest surface that makes signing out
 * discoverable without restyling anything that already works.
 */

import { requireAdminSession } from "@/lib/session-auth";
import { logoutAction } from "@/lib/actions/logout";
import { LogOut } from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdminSession();

  return (
    <>
      {/* Bug fix — same "top toolbar isn't sticky" issue as SiteNav.tsx
          (see that file's own comment): this admin-only sign-out bar
          renders directly below SiteNav on every /admin/* page, so it
          needs to stick too, immediately under it rather than overlapping
          it — `top-14` matches SiteNav's own fixed h-14 row height exactly.
          `h-8` (instead of letting padding size this) gives it a known,
          exact 32px height, so every /admin/* page's own sticky header
          (audit-log-dashboard.tsx and its siblings — see their own
          comments) can stack below both bars.
          Sticky Header Overlap fix, round 2 (2026-09-28) — see
          app/globals.css's own comment for the actual root cause (an
          `overflow-x-hidden` wrapper inside each dashboard was silently
          breaking `position: sticky` for its own sub-header, independent
          of whatever `top` value that sub-header used) and the
          `--admin-content-offset` custom property that replaces the
          Tailwind theme-token attempt from round 1. z-40 keeps this below
          SiteNav's z-50 (its mobile dropdown panel should always render
          above this bar, never behind it). */}
      <div className="sticky top-14 z-40 h-8 bg-slate-950 border-b border-slate-800 text-slate-400 text-xs px-4 flex items-center justify-end gap-3">
        <span>
          Signed in as <span className="text-slate-200 font-medium">{admin.email}</span>
        </span>
        <form action={logoutAction}>
          <button
            type="submit"
            className="inline-flex items-center gap-1 text-slate-400 hover:text-rose-400 transition-colors"
          >
            <LogOut className="w-3 h-3" /> Sign Out
          </button>
        </form>
      </div>
      {/* Sticky Header Overlap fix, round 2 (2026-09-28) — guaranteed floor,
          applied here so it protects EVERY /admin/* page whether or not
          that page also gives itself a sticky sub-header (app/admin/page.tsx,
          the console home, and app/admin/accounts/* have none of their own
          and were shipping with zero protection before this). For a page
          that DOES have its own sticky sub-header pinned at the same
          `--admin-content-offset`, this padding just sets that header's
          initial (pre-scroll) flow position to exactly where it will stick
          — no extra gap, no double-offset; see app/globals.css's comment. */}
      <div style={{ paddingTop: "var(--admin-content-offset)" }}>{children}</div>
    </>
  );
}
