# Admin UI for Auditor & Buyer (Client) Accounts

## What this delivers

A self-service admin-console screen (`/admin/accounts`) for provisioning
and managing Auditor and Client (buyer company) accounts — the same
capability that previously only existed as CLI scripts run on a
developer's machine (`scripts/create-auditor.ts`, `scripts/create-client.ts`,
`scripts/set-auditor-password.ts`, `scripts/set-client-password.ts`). Those
scripts are untouched and still work standalone.

This followed a roadmap check-in where the user asked whether to build
"RBAC token generation for auditors/buyers" or "B2B Analytics / Carbon
Footprint visualization" next. Research showed both broad areas already
had substantial, hardened work behind them (session-based Auditor/
Customer login, a multi-sprint ESG Analytics + Green Accounting suite),
so rather than build either from scratch, the actual gap was surfaced and
confirmed with the user: account/token *management* — the self-service
layer — was still CLI-only. That's what this sprint builds.

## What already existed and was reused untouched

- **`Auditor.passwordHash` / `Client.passwordHash`, `apiKeyHash`, `active`**
  — no schema changes to either model. This screen operates entirely on
  fields the Role-Based Authentication & Client/Auditor Portal Suite and
  the original Auditor/Client models already added.
- **`lib/auditor-auth.ts`'s `hashAuditorKey`** and **`lib/client-auth.ts`'s
  `hashClientKey`** — imported directly (not duplicated the way the CLI
  scripts duplicate them). Those scripts duplicate the hash function
  because they run standalone via `tsx` outside the Next.js module graph
  and can't cleanly resolve the `@/` alias; this feature runs inside the
  Next.js server context, so the real modules are available and reused.
- **`lib/password.ts`'s `hashPassword`** — same scrypt-based hashing the
  session-auth login path already verifies against.
- **The dual-path pattern** (Server Action for the in-app console, an
  ADMIN-gated REST route for external callers) — matches every other
  admin mutation in this app.
- **`components/dashboard/supplier-review-panel.tsx`'s "raw secret shown
  ONCE" modal convention** — reused for both the create-account flow and
  the new key-rotation flow.

## What was new

### Schema (additive only)

- **`AccountAuditLog` model + `AccountAuditAction` enum** — records who
  created, activated, deactivated, rotated the key of, or set the
  password for an Auditor/Client account. Deliberately **not** the same
  table as the existing `AuditLog`: `AuditLog.passportId` is a required
  FK, and an account-lifecycle event has no passport to attach to.
  Deliberately **not** hash-chained the way `AuditLog` is either — that
  tamper-evidence machinery protects a product's compliance record over
  its lifetime; this is a plain, append-only operational/security trail.
  `targetType` reuses the existing `SessionActorType` enum (`AUDITOR` /
  `CUSTOMER`) rather than introducing a parallel one, since it points at
  the exact same two tables `Session.actorType` already does.

This was a genuinely open design decision, presented to the user via
AskUserQuestion (new model vs. no dedicated audit trail for these
actions) — the user chose the new model, citing the project's EU
compliance/auditability standards.

### Service layer

- **`lib/services/account-audit-log.ts`** — `writeAccountAuditLog()`,
  always called inside the same `$transaction` as the account mutation
  it records.
- **`lib/services/manage-auditor-accounts.ts`** /
  **`lib/services/manage-client-accounts.ts`** — `list*Accounts`,
  `create*Account` (generates a raw API key, hashes it, optionally hashes
  a password, writes `ACCOUNT_CREATED`), `set*Active` (soft
  activate/deactivate, writes `ACCOUNT_ACTIVATED`/`ACCOUNT_DEACTIVATED`),
  `rotate*ApiKey` (issues a new key, immediately invalidating the old one
  since `apiKeyHash` is simply overwritten, writes `API_KEY_ROTATED`),
  `set*Password` (writes `PASSWORD_SET`; guards on the account having an
  email on file first, matching `scripts/set-auditor-password.ts`'s own
  rule that `/login` signs in by email). Deliberately two separate files
  rather than one generic actor-parameterized module — mirrors
  `lib/client-auth.ts` vs `lib/auditor-auth.ts`'s own "small duplication
  over premature abstraction" precedent, since the two entities have
  different field shapes (`name`+`organization` vs `companyName`+
  `country`).
- **`lib/types.ts`** — `CreateAuditorAccountInputSchema`,
  `CreateClientAccountInputSchema` (each refines "password requires an
  email/contactEmail on file"), `SetAccountPasswordInputSchema`.

### Server Actions + REST routes

- **`lib/actions/manage-auditor-accounts.ts`** /
  **`lib/actions/manage-client-accounts.ts`** — thin wrappers, `actor:
  "ADMIN"` hardcoded, same convention as every other in-app admin Server
  Action.
- **`app/api/admin/auditors/route.ts`** (`GET` list, `POST` create) +
  **`app/api/admin/auditors/[id]/route.ts`** (`PATCH`, dispatched by an
  `action` discriminator: `SET_ACTIVE` / `ROTATE_KEY` / `SET_PASSWORD`) —
  and the mirrored `app/api/admin/clients/**`. One discriminated `PATCH`
  endpoint per entity rather than three separate sub-routes (unlike e.g.
  the supplier-submission approve/reject sub-routes) — a deliberate,
  smaller-surface choice: these three operations are all "update this
  account," not independent workflows with their own review states.

### UI

- **`components/dashboard/access-control/access-control-dashboard.tsx`**
  — `AuditorAccountsPanel` and `ClientAccountsPanel`, each a list +
  create modal + per-row Rotate Key / Set-or-Reset Password / Activate-
  Deactivate actions, mirroring `supplier-review-panel.tsx`'s
  co-location and "secret shown once" conventions. The two panels stay
  separate components (same duplication rationale as the service layer
  above); the two account-management **modals** (`RotateKeyModal`,
  `PasswordModal`) ARE shared between them, since their mechanics are
  pure UI plumbing — each panel injects its own Server Action via a
  prop rather than the modal knowing which entity it's operating on.
- **`app/admin/accounts/page.tsx`** — new page, `force-dynamic`, same
  pattern as every other `/admin/*` report/management page.
- **`app/admin/page.tsx`** — new "Accounts" nav link, admin-console-only
  (not added to `app/page.tsx`'s nav row) — same precedent as
  Notifications and Suppliers: account provisioning isn't
  Material-Ledger-table-related, so the "two independent Material Ledger
  UIs" rule that governs QR/labeling-related nav changes doesn't apply.

## Explicitly not built

- Real Admin login/session (the admin console still uses the shared
  `DPP_ADMIN_API_KEY` gate) — a separate, larger deferred item, not
  addressed by this sprint.
- Bulk/CSV import of accounts, or self-service password reset by the
  auditor/buyer themselves (this screen is admin-driven only, matching
  how the CLI scripts it replaces worked).
- Deleting an account outright — matches this app's No-Hard-Delete /
  Immutability convention; deactivation (`active: false`) is the only
  supported revocation path, same as the CLI scripts.

## Verification

- `tsc --noEmit`: the 18 new errors introduced by this sprint's files
  all match the sandbox's documented pre-existing `@prisma/client`
  module-resolution cascade (unresolved named imports →
  downstream `TS7006`/`TS18046` on `$transaction` callback params and
  catch-block `error` values) — confirmed by checking every new error's
  file and shape against that known signature. Zero errors in the new
  REST routes, the new page, and the edited `app/admin/page.tsx`.
- Manual `{`/`}`, `(`/`)`, `[`/`]` balance check across all fourteen
  new/edited files — all balanced.
- Standalone esbuild + stub-Prisma runtime test (this project's
  established verification methodology, since the sandbox can't run
  `prisma generate` against Neon): bundled both service files with
  `@prisma/client`, `@/lib/prisma`, `@/lib/auditor-auth`,
  `@/lib/client-auth`, `@/lib/password`, `@/lib/types`, and
  `@/lib/services/account-audit-log` aliased to hand-written stubs, then
  ran 25 assertions against a mock Prisma backed by an in-memory store —
  covering account creation (with/without password, the
  password-requires-email refine), duplicate-email→409 handling,
  404-on-missing-id for every mutation, deactivate/reactivate, key
  rotation (confirms the hash actually changes), the "no email on file"
  password-set guard, and that every mutation writes the expected
  `AccountAuditLog` action. All 25 passed. Temp build/test files deleted
  afterward.
