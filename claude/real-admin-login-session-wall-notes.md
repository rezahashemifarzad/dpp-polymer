# Real Admin Login & Session Wall for /admin

Direct follow-up to the Production Readiness & Deployment Checklist's #1
finding: `/admin` (and every route under it) had no login wall at all —
`app/admin/layout.tsx` only redirected an already-signed-in AUDITOR/CUSTOMER
away; a fully anonymous visitor passed straight through. `lib/rbac.ts`'s
`DPP_ADMIN_API_KEY` only ever gated a handful of state-changing API routes
for machine callers, never page access.

## What changed

Extended the existing Role-Based Authentication & Client/Auditor Portal
Suite's session layer with a third actor type (ADMIN) rather than building a
parallel auth system — everything below is additive, and no existing
Prisma model, route, or page was removed or had a field taken away.

**`prisma/schema.prisma`**
- Added `ADMIN` to the existing `SessionActorType` enum.
- Added a new `AdminUser` model (`id`, `name`, `email` unique, `passwordHash`
  nullable, `active`, `createdAt`) — deliberately simpler than
  `Auditor`/`Client`: no `apiKeyHash`, no separate bearer-key portal to stay
  backward-compatible with, since this model exists purely to back password
  login. `passwordHash` stays nullable to match `Auditor.passwordHash` /
  `Client.passwordHash`'s own convention and `lib/actions/login.ts`'s
  existing "no password set — contact your administrator" handling.

**`lib/session-auth.ts`**
- Added `requireAdminSession()`, mirroring `requireAuditorSession()` /
  `requireClientSession()`.
- **Found and fixed a real bug while adding the third actor type**: both
  existing functions branched on `!== "AUDITOR"` / `!== "CUSTOMER"` — a
  two-value fallthrough that was correct when `SessionActorType` only had
  two values, but would have sent an ADMIN session hitting
  `/portal/auditor` to `/portal/customer`, which would then bounce it right
  back via `requireClientSession`'s own equivalent check — an infinite
  redirect loop. Fixed by naming every actor type explicitly in all three
  functions rather than relying on "anything that isn't X." Verified with a
  standalone esbuild+stub runtime test (15 assertions: every combination of
  {no session, AUDITOR, CUSTOMER, ADMIN, inactive-own-type} × the three
  `require*Session` functions) — all pass, no loop.

**`app/admin/layout.tsx`** — now calls `requireAdminSession()` instead of
just checking for AUDITOR/CUSTOMER sessions to redirect away. Every page
under `/admin/**` (Material Ledger, Accounts, ESG Analytics, Notifications,
everything) inherits this automatically — there's no per-route change
needed and no way for a future `/admin/*` page to ship unguarded. Also adds
a minimal "Signed in as `{email}` · Sign Out" bar above `{children}`, using
the same `logoutAction` the portals already use (it's actor-type-agnostic,
so no change was needed there). Deliberately did not touch
`components/SiteNav.tsx` (a shared client component with no session
awareness today) or restyle any individual admin page.

**`lib/actions/login.ts`** — `/login` now also checks `AdminUser.email`
(tried first, then `Auditor.email`, then `Client.contactEmail` — unchanged
order otherwise). A matched, active, correctly-passworded admin gets a
session and is redirected to `/admin` instead of a portal.

**`app/login/page.tsx`** — the "already signed in" redirect now also
handles an ADMIN session (→ `/admin`); copy updated from "Auditor & Client
Portal Access" to "Admin, Auditor & Client Access" since the same page now
serves all three.

**`middleware.ts`** — matcher extended from `/portal/:path*` to
`/portal/:path*", "/admin/:path*`, so an anonymous visitor hitting `/admin`
gets the fast Edge-safe redirect straight to `/login?next=...` instead of a
page-level redirect after a wasted render. This is a UX nicety layered on
top of the real check, not what makes `/admin` safe — `requireAdminSession()`
in the layout is the actual boundary and would still protect the data even
if `middleware.ts` were deleted (same reasoning already documented in that
file for the portal routes, re-applied here — see its CVE-2025-29927 note).

**New provisioning scripts** — `scripts/create-admin.ts` (creates an
`AdminUser` row with a password; simpler than `create-auditor.ts`/
`create-client.ts` since there's no API key to generate) and
`scripts/set-admin-password.ts` (resets an existing admin's password),
mirroring the existing Auditor/Client CLI scripts exactly.

## Deliberately out of scope

- No admin account management UI. `AdminUser` rows are CLI-provisioned
  only, same as how this project already treats bootstrap-style accounts —
  keeps this fix lightweight, per the request. The Accounts admin UI still
  manages only Auditor/Client.
- `lib/rbac.ts`'s `DPP_ADMIN_API_KEY` gate is completely untouched — that's
  a separate, still-working concern for machine/API callers (ERP
  integrations, scripts) hitting specific mutation routes with an
  `x-dpp-api-key` header.
- No "sign out everywhere" / session-invalidation-on-password-change. Same
  scope boundary the original portal suite drew for Auditor/Client.

## Verification

- Brace/paren/bracket balance check across every edited/new file — clean.
- `tsc --noEmit` diffed against the documented sandbox-only baseline (every
  error is the expected `@prisma/client` named-import-resolution cascade —
  `lib/session-auth.ts`'s new `AdminUser` import fails to resolve exactly
  like its existing `Auditor`/`Client` imports already did, and the two new
  scripts fail to resolve `PrismaClient` exactly like every sibling CLI
  script already does). `lib/actions/login.ts`, `app/admin/layout.tsx`,
  `app/login/page.tsx`, and `middleware.ts` — zero errors, including zero
  cascade errors.
- Standalone esbuild+stub runtime test (15 assertions) against
  `lib/session-auth.ts`'s three `require*Session()` functions, covering the
  full actor-type × session-state matrix — see the bug fix above.

## After merging: run `npx prisma db push` and create the first admin

Same as every schema change on this project (no migration history exists —
see the Production Readiness checklist), run `npx prisma db push` against
production `DATABASE_URL` to add the `ADMIN` enum value and the
`AdminUser` table. Then, **before that deploy goes live**, run once:

```
npx tsx scripts/create-admin.ts --name "Your Name" --email you@example.com --password "..."
```

Until at least one `AdminUser` row exists, `/admin` is unreachable by
anyone — that's the intended effect of this fix, not a bug, but it means
this step isn't optional.
