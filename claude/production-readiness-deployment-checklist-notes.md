# Production Readiness & Deployment Checklist

Audit requested after the SVHC schema-drift fix shipped and `npx prisma db push`
was run cleanly against production. Scope: environment variables, seed script
safety, and deployment configuration. This is an audit deliverable, not a code
change — nothing in the app was modified to produce this document.

## 0. Do these first (ranked by urgency)

**1. The admin console has no login wall at all.** `/admin/*` (Material Ledger,
Accounts, ESG Analytics, Notifications, everything) and `/` (`app/page.tsx`,
which is a full copy of the same console) render for **any anonymous visitor**
who knows or guesses the URL. `app/admin/layout.tsx` (added when the Role-Based
Auth suite shipped) only redirects a visitor who is *already logged in* as an
AUDITOR or CUSTOMER away from `/admin` — a visitor with no session at all, which
is anyone who hasn't logged into the auditor/client portals, passes straight
through untouched. `lib/rbac.ts`'s `DPP_ADMIN_API_KEY` only gates a handful of
state-changing API routes called with an explicit `x-dpp-api-key` header — it
was never wired to page access, and a browser session never sends that header.
Real ADMIN credential login was explicitly deferred when the session-auth suite
was built (see `app/admin/layout.tsx`'s own comment). Net effect: every batch
record, supplier data, compliance alert, and the new Accounts admin UI is
publicly readable and, for the client-portal-style mutation routes an admin
session isn't required for, potentially writable by anyone on the internet who
finds the URL. **This is the single biggest gap standing between this app and
"production-ready."** It needs a real admin login (a minimal `AdminUser` model
+ password, or at minimum wrapping `app/admin/layout.tsx` in the same
`requireXSession`-style check used for the other two roles) before this app
should be treated as safe to leave reachable at a real domain. I did not build
this — it's an architectural decision (new model vs. reusing something else)
that fits this project's "surface real open decisions via AskUserQuestion"
pattern rather than something to silently add. Let me know if you want me to
scope it next.

**2. A production `DATABASE_URL` — with live credentials — is sitting in this
Claude Project's knowledge base**, in a doc literally named `.env`. That's a
copy of your local `.env` file's contents that ended up saved into Project
docs at some point, which is a less access-controlled location than your
gitignored local file (anyone with access to this Claude Project can read it).
Treat that connection string as exposed: rotate the Neon database password /
regenerate the connection string from the Neon dashboard, update `DATABASE_URL`
everywhere it's actually used (your local `.env`, Vercel's env vars), and then
delete that `.env` doc from the Project. I have not repeated the value
anywhere and won't.

**3. `recovery-codes.txt` at the repo root is not covered by `.gitignore`.**
Your `.gitignore` only ignores `.env*`, `*.pem`, and build/dependency
directories — this file (107 bytes, confirmed present on disk) isn't matched
by any pattern. I have not opened it. Check whether it's ever been committed
(`git log --all --full-history -- recovery-codes.txt`) — if it has, those
codes should be treated as exposed and regenerated, and the file purged from
history, not just gitignored going forward. If it's never been committed,
just add `recovery-codes.txt` to `.gitignore` now and move it somewhere
outside the repo.

None of these three block a deploy from *succeeding* — the build will go
green regardless — but all three are real exposure, and #1 is the one I'd
fix before telling anyone this URL is live.

## 1. Environment variables

Confirmed by reading every service file that calls `process.env`, plus
`lib/rbac.ts`'s role-key map. Your local `.env` currently has only
`DATABASE_URL`; `.env.local` has only `NEXT_PUBLIC_BASE_URL` — so most of the
optional/RBAC vars below aren't set even in your dev environment today.

| Variable | Required? | Purpose | What happens if unset |
|---|---|---|---|
| `DATABASE_URL` | **Required** | Neon Postgres connection string, read by `prisma.config.ts` | App cannot start / every DB call fails |
| `NEXT_PUBLIC_BASE_URL` | **Required in production** | Base URL used to build every GS1 QR/passport link (`lib/qr.ts`), the demo GS1 URI on `/`, and supplier-submission links | `lib/qr.ts` already detects this and logs a hardening warning in production, but silently falls back to `http://localhost:3000` baked into persisted QR links — this bit the SVHC-adjacent deploy before; confirm it's set in Vercel's env vars for the production domain |
| `DPP_MANUFACTURER_API_KEY` | Optional (fails closed) | RBAC key for manufacturer-role API routes (`lib/rbac.ts`) | Manufacturer-role routes reject every request with 401 — nothing crashes, that role is just unusable until set |
| `DPP_AUDITOR_API_KEY` | Optional (fails closed) | RBAC key for auditor-role API routes | Same — auditor-role REST routes 401 until set (note: this is separate from the new session-based `/portal/auditor` login, which uses `passwordHash` + session cookies, not this key) |
| `DPP_ADMIN_API_KEY` | Optional (fails closed) | RBAC key for admin-role state-changing API routes | Same — admin-role mutation routes 401 until set. **Does not gate `/admin` page access at all** — see finding #1 above |
| `RESEND_API_KEY` | Optional | Outbound notification email via Resend's HTTP API | `isEmailDispatchConfigured()` returns false; every notification event logs an EMAIL row with status `SKIPPED` instead of sending — no crash, just silent no-email |
| `DPP_NOTIFICATION_EMAIL_FROM` | Optional | Verified sender address for the above | Same graceful `SKIPPED` degradation, paired with `RESEND_API_KEY` |
| `CRON_SECRET` | Optional but should be set | Bearer-token auth on `GET /api/notifications/sweep`, which `vercel.json` schedules daily at 06:00 UTC | If unset, check whether that route enforces the check unconditionally — if it does, the daily cron will 401 itself and expiry/anomaly notifications silently stop firing |
| Webhook signing secrets | N/A | Per-endpoint, DB-stored (`WebhookEndpoint.secret`), shown once in the admin UI | Not an env var at all — nothing to configure here |
| ERP / manufacturer auth | N/A | Per-manufacturer `apiKeyHash` stored in the DB | Not an env var — provisioned via `scripts/set-manufacturer-key.ts` |
| AI Assistant widget | N/A | Confirmed deterministic/keyword-routed over existing services — no LLM API key anywhere in dependencies or `.env` | Nothing to configure |

Action: confirm in Vercel's dashboard that `DATABASE_URL` and
`NEXT_PUBLIC_BASE_URL` are set for the Production environment (not just
Preview/Development), and decide whether `CRON_SECRET`, the three RBAC keys,
and the Resend pair should be set now or deliberately left off for this
launch.

## 2. Seed script

`prisma/seed.ts` is production-safe as-is: it only runs on an explicit
`npx prisma db seed` invocation (wired via `package.json`'s
`"prisma": { "seed": "tsx prisma/seed.ts" }`), not on `db push`, `next build`,
or any automated step. It upserts a demo manufacturer keyed on `vatNumber`, so
running it twice is harmless. No change needed here — just don't run
`npx prisma db seed` against the production `DATABASE_URL` unless you actually
want that demo manufacturer row in production data.

## 3. Deployment configuration

- **No migration history exists.** `prisma.config.ts` declares a
  `migrations.path`, but the folder has never been populated — every schema
  change so far has gone live only via manual `npx prisma db push`. This is
  the root cause of the SVHC production bug you just fixed, and it's a
  standing process risk: `db push` has no rollback and no per-change audit
  trail the way `prisma migrate` does. Worth deciding deliberately whether to
  stay on `db push` (simpler, matches everything built so far) or move to
  `prisma migrate deploy` for future schema changes (safer for a
  multi-person or higher-stakes stage) — not something to switch silently.
  One inconsistency to clean up either way: `claude/phase7-step1-notification-webhook-suite-notes.md`
  told you to run `npx prisma migrate dev --name notification_webhook_suite`
  for that sprint, which doesn't match how this project actually operates (no
  migrations folder was ever created) — if that command was run, it may have
  been a no-op or partially applied outside the `db push` flow worth
  double-checking; going forward, `db push` is the one real method until you
  decide to change that.
- **`next.config.ts` sets `typescript: { ignoreBuildErrors: true }`.** This
  was set to unblock builds against a sandbox-only Prisma-client-typing
  artifact, but it means Vercel will deploy even with genuine TypeScript
  errors — there's currently no automated type-safety gate on production
  deploys. Worth running `tsc --noEmit` locally (with real generated Prisma
  types, not the sandbox's stub cascade) before merging to confirm this isn't
  masking anything real right now, and considering flipping it off once
  you've confirmed a clean baseline.
- **No test suite exists.** `package.json` only has `dev`/`build`/`start`/
  `lint`/`postinstall` — no `test` script, no CI-enforced checks. Every
  sprint's verification so far has been ad hoc (manual `tsc`, esbuild+stub
  runtime tests, Playwright visual passes). Not a blocker, but worth knowing
  going in: nothing currently stops a regression from reaching production
  automatically.
- **Vercel Cron** (`vercel.json`) is configured for one job:
  `GET /api/notifications/sweep` daily at 06:00 UTC. Confirm `CRON_SECRET` is
  set if that route checks it (see the env var table above) — otherwise this
  job may be silently failing every day.
- **`.gitignore`** correctly covers `.env*`, `*.pem`, build/dependency
  directories, and `dev.db`. The one gap is `recovery-codes.txt` (finding #3
  above).

## Summary

Nothing here blocks a build from succeeding on Vercel — the schema-drift fix
and the account admin UI are both solid, committed, and migrated cleanly.
What's actually open before calling this "100% production-ready" is
access control on `/admin`, rotating the exposed database credential, and
closing the `recovery-codes.txt` gitignore gap — all three are about who can
reach and see this data, not whether the code runs.
