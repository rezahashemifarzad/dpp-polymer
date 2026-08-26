# Access Control Fix — Portal "Home" Navigation Leaking to Admin Console

## The bug

Clicking "Home" (or the "Polymer.DPP" logo) while signed in at `/portal/auditor`
or `/portal/customer` dropped the visitor straight into administrative data.

## Root cause

Two separate things compounded:

1. **`/` is not a neutral landing page — it *is* the admin console.**
   `app/page.tsx` renders the full internal Material Ledger dashboard (the
   same one `/admin` shows), and until this fix, `/admin` had zero
   session/role checks in front of it — `lib/rbac.ts`'s shared
   `DPP_ADMIN_API_KEY` only ever gated specific state-changing API calls
   (verify/revoke), never page access.
2. **`SiteNav` (rendered globally from `app/layout.tsx`) was showing on the
   portal pages.** Its brand link and "Home" nav entry both point at `/`,
   and it also lists an outright "Admin Console" link — all visible to a
   signed-in Auditor/Customer, stacked as a second header above each
   portal's own self-contained one.

## What was fixed

- **`components/SiteNav.tsx`** — added `/portal/` to the same pathname
  exclusion the public QR scan page already uses (`/01/`), for the same
  reason: both destinations already have their own self-contained header,
  and stacking this internal-tooling nav (with its "Admin Console" link)
  on top exposes the wrong audience to the wrong data.
- **`app/portal/auditor/page.tsx`** / **`app/portal/customer/page.tsx`** —
  each page's own "Home" link now points at its own portal
  (`/portal/auditor` / `/portal/customer`) instead of `/`.
- **`app/admin/layout.tsx`** (new) — a Server Component layout wrapping
  every route under `/admin/**` (automatic for all current and future
  admin sub-routes — suppliers, notifications, esg-analytics,
  green-accounting, audit, generator, search). Calls
  `getSession()` (`lib/session-auth.ts`); an active `AUDITOR` session is
  redirected to `/portal/auditor`, a `CUSTOMER` session to
  `/portal/customer`, before any admin page renders or fetches data. A
  visitor with no session (anonymous, or a future real admin) passes
  through unchanged — this intentionally does not add a login requirement
  to `/admin`; that remains the separately-flagged, deferred "real
  AdminUser + admin session" gap.
- **`middleware.ts`** — comment-only correction: it previously claimed
  `/admin/*` was "already gated per-route via lib/rbac.ts's shared API
  key," which was only ever true for specific mutation routes, never page
  access. Now points at `app/admin/layout.tsx` as the actual fix, and
  explains why the check lives there (Server Component, can safely import
  `lib/session-auth.ts`/Prisma) rather than in this Edge-runtime file.

## Verification

- `tsc --noEmit` — zero new errors on any touched file (the one error on
  `app/portal/auditor/page.tsx` is the same pre-existing, sandbox-only
  Prisma-generate-cascade line already documented in this project's other
  sprint notes, unrelated to this change).
- Standalone esbuild+stub unit test of `app/admin/layout.tsx` (mocked
  `next/navigation` and `@/lib/session-auth`, same harness pattern used
  earlier for `lib/session-auth.ts`/`lib/password.ts`): no session → renders
  children, no redirect; `AUDITOR` session → redirects to `/portal/auditor`;
  `CUSTOMER` session → redirects to `/portal/customer`. All three passed.
