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
 *   - It does not touch proxy.ts's real security boundary — that
 *     stays the DB-backed check here (see lib/session-auth.ts's own
 *     CVE-2025-29927 note on why middleware is only ever a fast, non-
 *     authoritative first filter). proxy.ts's matcher was extended to
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
      {/* Sticky Header Overlap fix, round 2 (2026-09-28) — a "guaranteed
          floor" padding wrapper was added here on the mistaken belief that
          app/admin/page.tsx and app/admin/accounts/* (pages with no
          sticky sub-header of their own) rendered their content with zero
          offset from SiteNav + the sign-out bar above. That was wrong:
          `position: sticky` elements still occupy their own height in
          normal document flow (only `position: fixed` removes an element
          from flow) — SiteNav (h-14, 3.5rem) and this bar (h-8, 2rem)
          already push every subsequent sibling, i.e. `children` below,
          down by their combined 5.5rem naturally, with no extra CSS
          needed. Adding a second, explicit `paddingTop:
          var(--admin-content-offset)` (also 5.5rem) here DOUBLED that to
          11rem for every /admin/* page, and since that extra padding band
          had no background of its own, it showed app/globals.css's
          `body` background straight through — solid white for anyone not
          in OS dark mode (`body`'s dark background only applies under a
          `prefers-color-scheme: dark` media query) — as a large box
          spanning the full page width, reported as a "White Box" bug
          (2026-09-28). Removed entirely: `{children}` here relies purely
          on the natural flow height above it, exactly as it always did
          for pages with no sticky sub-header of their own — no wrapper,
          no padding, nothing to double up. Pages that DO have their own
          sticky sub-header (see each dashboard's own comment) still pin
          it at `top: var(--admin-content-offset)` via inline style; its
          natural (unscrolled) flow position already lands at exactly
          5.5rem too, since it's the very first thing rendered inside
          `children`, so it coincides with its own sticky offset with no
          gap either. */}
      {children}
    </>
  );
}
