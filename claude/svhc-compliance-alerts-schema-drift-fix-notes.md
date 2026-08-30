# Production Fix: SVHC Compliance Alerts — Schema Drift

## The report

After deploying to Vercel, the admin console showed: `Couldn't load SVHC
compliance alerts - Failed to compute SVHC compliance alerts`.

## Root cause

This project has **no `prisma/migrations` history** — `prisma/migrations`
is declared in `prisma.config.ts` but the folder has never actually
existed in the repo. Schema changes here have always been applied with
`npx prisma db push`, not `prisma migrate deploy`, and `package.json`'s
`postinstall` only runs `prisma generate` (regenerates the client's
TypeScript types from `schema.prisma`) — it does **not** push the schema
to any database. Committing a schema change and deploying the app code
does NOT get that schema change onto a database; `db push` has to be run
against that database's `DATABASE_URL` separately, by hand.

`svhcStatus` / `svhcStatusDeclaredAt` were added to `PolymerPassport`
several sprints ago. If `db push` was never run against the production
Neon database since then, those columns simply don't exist there yet —
`computePortfolioSvhcSummary()`'s queries against them fail with Prisma
error **P2022 ("column does not exist")**, which the route's existing
`catch` turned into the generic, unhelpful "Failed to compute SVHC
compliance alerts" message.

This is very likely not limited to the SVHC columns — anything added to
the schema since the production database was last `db push`-ed is
equally missing (PPWR fields, the ERP `apiKeyHash`/`apiKeyActive`
columns, the newest `AccountAuditLog` table, etc.). `db push` reconciles
the *entire* current schema in one run, so a single push catches up on
all of it at once — no need to push column-by-column or sprint-by-sprint.

## What was fixed (all three of the user's asks)

**1. "Does the Prisma query safely handle missing tables/fields?"** — Not
in the sense of silently working around a missing column (that's not
possible — the column genuinely doesn't exist, so the query cannot
succeed until the database is synced). What was added is *detection*:
`lib/services/schema-drift.ts` (new) exports `wrapSchemaDrift()`, which
runs a Prisma call and re-throws specifically Prisma **P2021** ("table
does not exist") or **P2022** ("column does not exist") as a new
`SchemaOutOfDateError` with a clear, actionable message naming the
missing column/table and the fix (`npx prisma db push`). Every other
error — a different Prisma code, a connection failure, anything else —
passes through completely unchanged; this deliberately does not become a
general-purpose catch-all that could mask a genuinely different failure
as a schema problem.

**2. "Add proper error boundary / fallback handling so it doesn't crash
the UI route."** The route already had a `try`/`catch` (so nothing was
crashing the whole app — the admin console's existing error banner with
a Retry button was already the fallback UI), but the message it showed
gave no indication of the actual cause. `lib/services/svhc-compliance-service.ts`
now wraps its `Promise.all(...)` in `wrapSchemaDrift()`, and
`app/api/passports/svhc-alerts/route.ts` catches `SchemaOutOfDateError`
specifically, returning it as a **503** (service temporarily
unavailable/misconfigured, rather than a generic 500) with the specific,
actionable message — shown verbatim in the `SvhcComplianceBanner`'s
existing error state, so an admin sees "run `npx prisma db push`"
directly in the UI instead of just the generic failure text.

**3. "Do I need to run `npx prisma db push` on Neon?"** — **Yes.** Run it
with `DATABASE_URL` pointed at the **production** Neon connection string
(not local/dev):

```
DATABASE_URL="<production-neon-connection-string>" npx prisma db push
```

This is additive-only (new nullable/defaulted columns, new tables) —
consistent with this project's Baseline Rule — so it should apply
cleanly with no data-loss prompts. If `db push` does show a data-loss
warning for anything, stop and share it before confirming; that would
mean something unexpected is different about the production schema.

## Not done (flagged, not silently skipped)

This project relying entirely on `db push` (no migration history) is a
real gap for a production compliance app — there's no record of *when*
each schema change was applied to *which* database, and no repeatable,
reviewable migration file per change. Introducing `prisma migrate
deploy` with a real migration history is a bigger, separate decision
(it would need care to reconcile with the schema already live in
production) and wasn't part of what was asked here, so it wasn't
started — flagging it as a natural next step if this kind of drift
becomes a recurring problem.

## Verification

- `tsc --noEmit`: the 5 new errors introduced by `schema-drift.ts` all
  match the sandbox's documented pre-existing `@prisma/client`
  module-resolution cascade. Zero new errors in
  `svhc-compliance-service.ts` or the route.
- Manual `{`/`}`, `(`/`)`, `[`/`]` balance check — all three touched
  files balanced.
- Standalone esbuild + stub-Prisma runtime test: 8 assertions confirming
  `wrapSchemaDrift()` actually re-throws P2021/P2022 as
  `SchemaOutOfDateError` (with the target column/table named in the
  message and `npx prisma db push` mentioned), that a *different* Prisma
  error code (P2002) and a generic error both pass through **unchanged**
  (not misreported as schema drift), and that the success path returns
  the value untouched. All 8 passed; temp build/test files deleted
  afterward.
