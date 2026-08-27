# ERP / Automated Batch Intake Integration

## Scope decisions (confirmed before writing any code)

The request asked for REST endpoints and webhooks so an ERP (SAP, Microsoft
Dynamics) can push MFI/ISO 1133, recyclate %, PCF carbon footprint, and
ISCC PLUS mass-balance data directly into the system. Four genuinely open
architecture questions were resolved before building:

1. **Ingestion flow: direct-to-passport**, not a review queue. An ERP push
   authenticates as one specific, already-known manufacturer (see below) —
   unlike the Supplier Onboarding Portal, which exists precisely because an
   invited external party is *not* already a trusted, authenticated actor.
   Adding a review queue here would fight the "automation" goal of the
   request for no corresponding safety benefit.
2. **Credential model: per-manufacturer `apiKeyHash`**, mirroring
   `Auditor.apiKeyHash` / `Client.apiKeyHash` exactly rather than a new
   standalone credential model. One key per manufacturer is enough for an
   MVP integration and keeps the schema surface small; a multi-key-per-
   manufacturer model can be added later without touching this shape if a
   real need for per-ERP-environment keys shows up.
3. **Mass balance: existing percentage fields are enough.** ERP payloads
   populate `Certification.massBalanceAllocationPercent` (already present,
   already accepts `scheme: "ISCC_PLUS"`) — no new credit-ledger/pool model
   this phase. A real decrementing credit ledger with over-draw protection
   is a small accounting subsystem in its own right, not something to bolt
   onto an API-design task without being asked for it directly.
4. **Outbound webhooks: out of scope for this phase.** This ships inbound
   intake only. Notifying an ERP of later status changes (VERIFIED/REVOKED)
   reuses the existing `WebhookEndpoint`/`dispatchWebhook` suite from Phase
   7 almost as-is — a fast, focused follow-up once inbound is proven, not
   bundled in here.

## What already existed and was reused untouched

Research before writing any schema/route confirmed the domain data model
needed **zero new fields** — everything the request asked for was already
on `PolymerPassportInputSchema` / `CertificationInputSchema`:
`meltFlowIndex` + `mfiTestStandard` (defaults to `"ISO 1133"`),
`recycledContentPercent`, `carbonFootprintKgCO2ePerKg`, and a
`certifications[]` array whose `CertificationScheme` enum already includes
`ISCC_PLUS` with an existing `massBalanceAllocationPercent` field. This
phase is authentication + a route + audit-trail wiring, not a data-model
change.

- **`lib/services/create-passport.ts`'s `createPassport()`** — called
  completely unmodified as the one canonical creation path. Not
  re-implemented, not forked.
- **The `{success,error,issues}` / `{success,data}` response convention**
  and HTTP status mapping — matched exactly, same as every other write
  route.
- **The Auditor/Client `apiKeyHash` + soft-revoke (`active`) pattern** —
  mirrored for `Manufacturer`, including the "resolved via a unique-index
  lookup, never a comparison loop" rationale.
- **The `SUPPLIER_SUBMISSION_APPROVED` precedent** — a feature documents
  its own intake channel as a SECOND, follow-up `AuditLog` entry written
  right after `createPassport()` returns, rather than modifying what
  `createPassport()` itself records. `CREATED_VIA_ERP_INTEGRATION` follows
  this exactly.

## What was new

- **`prisma/schema.prisma`** — `Manufacturer.apiKeyHash String? @unique` +
  `apiKeyActive Boolean @default(true)` (nullable/defaulted, every existing
  row unaffected until a key is provisioned); new `AuditAction` member
  `CREATED_VIA_ERP_INTEGRATION`.
- **`lib/erp-auth.ts`** (new) — `x-dpp-manufacturer-key` header auth,
  SHA-256 hash lookup, soft-revoke check. Deliberately a third duplicate of
  the same small pattern already in `lib/auditor-auth.ts`/`lib/client-auth.ts`
  rather than a shared abstraction extracted now — `lib/client-auth.ts`'s
  own banner names "a third actor type" as the trigger for that extraction;
  noted as a good follow-up, not bundled into this task.
- **`app/api/erp/passports/route.ts`** (new) — `POST` authenticates via
  `lib/erp-auth.ts`, forces `manufacturerId` to the authenticated caller's
  own id (closing the gap `app/api/passports/route.ts`'s own `TODO(auth)`
  comment already flagged — an ERP can never push a batch under another
  manufacturer's identity), calls `createPassport()`, writes the follow-up
  audit entry, returns `201`. `DELETE` blocked with the same No-Hard-Delete
  405 policy every other passport route already enforces.
- **Idempotency hardening in `create-passport.ts` itself** (benefits every
  caller, not just this route): the existing `batchId` pre-check
  (`findUnique` then `create`) is not atomic with the `INSERT` — a genuine
  race (two near-simultaneous requests for the same `batchId`, a real
  concern once an ERP's own retry-on-timeout logic can resend a request)
  previously bubbled as an uncaught `P2002` Prisma error → an opaque `500`.
  Now caught and translated into the exact same friendly `409` the
  pre-check already returns, so an ERP's retry logic can safely treat `409`
  as "already created, stop retrying." Every other unexpected failure still
  throws unchanged.
- **`scripts/set-manufacturer-key.ts`** (new) — provisions/rotates an ERP
  key for an existing `Manufacturer` row (`--id` or `--vat`), or soft-
  revokes one (`--deactivate`). Manufacturer has no standalone "create"
  flow (rows come from ordinary passport creation), so unlike
  `create-auditor.ts` this only ever attaches credentials to an existing
  row, never creates one.

## Explicitly not built (see scope decisions above)

- A `SupplierSubmission`-style review queue for ERP-pushed batches.
- A standalone ISCC PLUS mass-balance credit ledger.
- Outbound webhook notifications back to the ERP.
- Extraction of a shared "actor auth" helper across Auditor/Client/Manufacturer
  (now three structurally-identical modules — the trigger point
  `lib/client-auth.ts` itself named, worth doing as its own follow-up).

## Verification

- `tsc --noEmit` diffed against this project's documented sandbox-only
  baseline (this sandbox cannot run `prisma generate` against Neon, so
  every `@prisma/client` named-import fails to resolve — a pre-existing,
  already-documented cascade, not a real bug). `app/api/erp/passports/route.ts`
  itself: **zero errors**. `lib/erp-auth.ts` and `scripts/set-manufacturer-key.ts`
  each show exactly one error, both the same already-documented pattern
  (an unresolved named import from `@prisma/client`) every other file in
  this cascade already shows. `create-passport.ts`'s new `catch` block adds
  four more instances of that same cascade (`Prisma` resolving to `any` in
  this sandbox defeats TypeScript's `instanceof` narrowing on the `catch`
  variable) — confirmed by manual review this disappears once a real
  generated client makes `Prisma.PrismaClientKnownRequestError` a proper
  class type, which is exactly what `instanceof` narrowing needs.
- Standalone esbuild+stub runtime test of the new `P2002` idempotency catch
  in `create-passport.ts` (mocked transaction client; a shared-identity
  stub `PrismaClientKnownRequestError` class set on `globalThis` before the
  bundle is imported, so `instanceof` inside the bundled code sees the same
  class the test throws — the sandbox's lack of a real generated client
  otherwise makes two "identical" stub classes fail `instanceof` against
  each other): a `P2002` on `batchId` (array-shaped `meta.target`) → `409`;
  a `P2002` on `batchId` (string-shaped `meta.target`, seen on some Prisma
  versions) → `409`; a `P2002` on an unrelated field → rethrown, not
  miscategorized as a duplicate batch; a non-`P2002` failure (e.g. a
  connection reset) → rethrown unchanged; and three regression checks
  (ordinary success still returns `201`, unknown manufacturer still `404`s,
  the original pre-check duplicate-`batchId` path still `409`s) all still
  pass. All seven passed. Temp build/test/stub files deleted after the run.
- Manual `{`/`}` and `(`/`)` balance check across the full, edited
  `prisma/schema.prisma` (`npx prisma validate` needs a network fetch this
  sandbox doesn't have — same documented limitation as `prisma generate`):
  44/44 braces, 388/388 parens.

## Deploying this

1. `npx prisma generate && npx prisma db push` (adds `Manufacturer.apiKeyHash`
   / `apiKeyActive` and the new `AuditAction` enum value — additive, no
   existing rows affected).
2. For each manufacturer that should get ERP access:
   `npx tsx scripts/set-manufacturer-key.ts --id <manufacturer-uuid>` — save
   the printed key, it's shown once.
3. Give that key to the manufacturer's ERP administrator to send as the
   `x-dpp-manufacturer-key` header on `POST /api/erp/passports`.
