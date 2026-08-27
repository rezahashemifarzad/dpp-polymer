# REACH SVHC & PPWR Compliance

## Scope decisions (confirmed before writing any code)

Three genuinely open questions were resolved before building:

1. **SVHC status: an explicit, required-with-default field on every
   passport** (`SvhcStatus { NOT_ASSESSED, NONE_DECLARED, SVHC_PRESENT }`,
   defaults to `NOT_ASSESSED`), not an optional field only populated when a
   substance is actually present. An EU market-surveillance audit needs to
   be able to tell "assessed, none found" apart from "nobody ever
   checked" — silence can't carry that distinction.
2. **No Auditor review gate for either declaration.** REACH Article 33 is
   legally the *supplier's own* binding statement, not a third-party
   certificate — an Auditor doesn't "grant" SVHC compliance the way they
   verify a Certification. Both `declareSvhcStatus` and
   `declarePpwrCompliance` publish immediately, clearly labeled
   self-declared on the public scan page (`reach.selfDeclared`), matching
   how Article 33 actually works rather than forcing it through a workflow
   built for third-party certificates.
3. **PPWR fields live directly on `PolymerPassport`, nullable, not
   defaulted.** Unlike SVHC status, most batches in this system
   legitimately have no PPWR assessment at all — this product covers
   polymer batches broadly, not exclusively packaging — so a required
   status field would misrepresent "not applicable" as "not yet checked."

## What already existed and was reused untouched

- **The `Certification` "attach to an existing batch" pattern**
  (`lib/services/add-certification.ts`,
  `app/api/passports/[batchId]/certifications/route.ts`) — both new
  declarations follow this shape exactly: a `PATCH` route under
  `/api/passports/[batchId]/...`, gated with `lib/rbac.ts`'s
  `authorize(req, ["MANUFACTURER", "ADMIN"])`, a service function that
  resolves `batchId` → passport `id`, mutates in a `$transaction`, and
  writes a matching `AuditLog` entry. Applied proactively here (this data
  is designed to arrive post-creation from day one) rather than needing a
  follow-up fix the way Certification's own spec had to add one later.
- **The `{success,error,issues}` / `{success,data}` response convention**
  and Zod-`.safeParse` → `ok:false` result shape — matched exactly.
- **"Conditional validation belongs in Zod, not a DB constraint"** — the
  precedent from `CertificationInputSchema.massBalanceAllocationPercent`
  — applied to "substances[] required and non-empty exactly when status
  is SVHC_PRESENT."
- **"Post-issuance additions never retroactively invalidate the sealed
  recordHash"** — the precedent already established for
  `chainOfCustodyRecords`, `revokedAt`/`revocationReason`, and
  certifications added after creation. `lib/verifyPassport.ts`'s
  `hashRecord()` recompute is untouched; the new fields are explicitly
  excluded, same as those.
- **`createPassport()` itself — untouched.** No new fields were added to
  `PolymerPassportInputSchema`; this is a fully separate, additive layer.

## What was new

- **`prisma/schema.prisma`** — `SvhcStatus` and `PpwrRecyclabilityGrade`
  enums; on `PolymerPassport`: `svhcStatus` (defaulted), `svhcStatusDeclaredAt`,
  `svhcStatusDeclaredBy`, `ppwrRecyclabilityGrade`, `ppwrPfasCompliant`,
  `ppwrPfasConcentrationPpb`, `ppwrAssessedAt`, `ppwrAssessedBy` (all
  nullable); new `SubstanceDeclaration` model (one row per SVHC found,
  only ever created when `svhcStatus` is `SVHC_PRESENT`); new `AuditAction`
  members `REACH_SVHC_DECLARED` / `PPWR_COMPLIANCE_DECLARED`.
- **`lib/types.ts`** — `SubstanceDeclarationInputSchema` (CAS-number
  regex, 4-decimal concentration precision, candidate-list date),
  `SvhcDeclarationInputSchema` (the conditional substances[] rule above),
  `PpwrComplianceInputSchema` (all fields independently optional).
- **`lib/services/declare-svhc-status.ts`** — replaces (not merges) a
  passport's current SVHC declaration on every call: the previous
  declaration isn't lost, it stays fully reconstructable from
  `REACH_SVHC_DECLARED` AuditLog history, same "current = latest,
  resolved at read time" precedent `AuditorVerification` already
  established for auditor sign-offs.
- **`lib/services/declare-ppwr-compliance.ts`** — sets/updates the PPWR
  fields independently of SVHC status (a batch's recyclability grade and
  its REACH status are reassessed on different schedules).
- **`app/api/passports/[batchId]/svhc/route.ts`** and
  **`.../ppwr/route.ts`** — thin `PATCH` wrappers, MANUFACTURER/ADMIN
  gated.
- **Public disclosure** — `lib/verifyPassport.ts`'s `getVerifiedPassport()`
  now also selects `substanceDeclarations` (the new scalar fields come
  through automatically since this query already uses `include`, which
  never restricts base-model scalars); the GS1 resolver page
  (`app/01/[gtin]/21/[serialOrBatch]/page.tsx`) passes all of it through;
  `components/PublicScanPage.tsx` gained a "REACH Article 33" section
  (always shown, including `NOT_ASSESSED`, with substance detail when
  present) and a "PPWR Packaging Compliance" section (shown only once a
  batch actually has an assessment on file) — both clearly labeled
  self-declared, both new i18n keys added across en/de/fr.

## Explicitly not built (see scope decisions above)

- Any Auditor VERIFIED/REJECTED workflow for either declaration.
- An admin dashboard UI (add/edit modal, a compliance queue view) for
  submitting these declarations — same as the ERP integration and
  No-Hard-Delete tasks, this phase is schema + backend + public
  disclosure; a `components/dashboard/reach-ppwr/` panel is a natural
  next-phase UI task, not bundled in here.
- A packaging-category-specific PPWR recycled-content target matrix
  (PPWR's minimum-recycled-content mandates vary by packaging category
  and phase-in year) — out of scope; `recycledContentPercent` already
  exists and is reused as-is.

## Verification

- `tsc --noEmit` diffed against this project's documented sandbox-only
  baseline (this sandbox cannot run `prisma generate` against Neon, so
  every `@prisma/client` named-import fails to resolve). Both new routes
  (`svhc/route.ts`, `ppwr/route.ts`) and `components/PublicScanPage.tsx`
  itself: **zero errors**. Every other new/edited file shows only
  instances of the exact same already-documented cascade pattern (an
  unresolved `@prisma/client` named import, or an `any`-typed parameter
  downstream of one) — no new class of error anywhere.
- Standalone esbuild+stub test of the Zod validation logic (stubbed
  `SvhcStatus`/`PpwrRecyclabilityGrade` enum objects, since the sandbox's
  unresolved Prisma client means the real generated enums aren't
  available to import): 10 cases — `NONE_DECLARED`/`NOT_ASSESSED` with no
  substances accepted; `SVHC_PRESENT` with zero substances rejected;
  `SVHC_PRESENT` with a valid substance accepted; `NONE_DECLARED` with a
  substance provided anyway rejected (status/substances mismatch); a
  malformed CAS number rejected; an out-of-range concentration (>100%)
  rejected; PPWR's fully-empty input accepted (every field optional); a
  valid PPWR payload accepted; an invalid recyclability grade rejected.
  All 10 passed.
- Manual `{`/`}` and `(`/`)` balance check across every edited file
  (`prisma/schema.prisma` couldn't be checked with `prisma validate` —
  same offline-sandbox limitation as `prisma generate`; the manual
  brace/paren check plus a clean `tsc` pass on every file that imports
  from it stand in) — all balanced.

## Deploying this

1. `npx prisma generate && npx prisma db push` (adds the new enums, the
   `SubstanceDeclaration` table, the new nullable/defaulted
   `PolymerPassport` columns, and the two new `AuditAction` values —
   additive, no existing rows affected; every existing passport gets
   `svhcStatus = NOT_ASSESSED` and every PPWR field `null`).
2. To declare a batch's SVHC status:
   `PATCH /api/passports/{batchId}/svhc` with
   `{ "status": "NONE_DECLARED" }` or
   `{ "status": "SVHC_PRESENT", "substances": [{ "casNumber": "117-81-7", "substanceName": "...", "concentrationPercent": 0.15, "candidateListDate": "2024-06-27" }] }`,
   headers as any other MANUFACTURER/ADMIN write (`x-dpp-api-key`).
3. To declare PPWR compliance: `PATCH /api/passports/{batchId}/ppwr` with
   any subset of `{ recyclabilityGrade, pfasCompliant, pfasConcentrationPpb }`.
