# REACH & PPWR Compliance — Admin Dashboard UI

Follow-up to `claude/reach-ppwr-compliance-notes.md` (schema + backend +
public disclosure). This phase adds the admin panel for declaring/updating
both, left as a deliberate follow-up in that earlier sprint.

## What already existed and was reused untouched

- **`components/dashboard/batch-details-modal.tsx`'s panel-per-section
  layout and Server-Action-backed form convention.** Every existing panel
  in this modal (Genealogy, Carbon, Chain-of-Custody) follows the same
  shape: a bordered `rounded-2xl` box, a header row (icon + title), a
  read-only summary of current state, and a form posting through a
  Server Action reached via a `usePassports()` hook method. The new REACH
  & PPWR panel follows this exactly — no new interaction pattern invented.
- **The dual-path pattern** (Server Action for in-app, RBAC'd REST route
  for external callers) — `lib/actions/declare-svhc-status.ts` and
  `lib/actions/declare-ppwr-compliance.ts` are thin wrappers calling the
  same `lib/services/declare-svhc-status.ts` / `declare-ppwr-compliance.ts`
  functions the `PATCH /api/passports/[batchId]/svhc` / `.../ppwr` routes
  already call — never a second implementation of the declare logic.
- **`components/dashboard/expiry-alert-badge.tsx`'s "one shared,
  color-coded status chip, icon + label, never color alone" convention** —
  mirrored exactly by the new `SvhcStatusBadge`.
- **`GET /api/passports` / `GET /api/passports/[batchId]`'s existing
  `include` blocks** — both already used `include` (not a narrow `select`),
  so the new `PolymerPassport` scalar columns (`svhcStatus`, the `ppwr*`
  fields) were already flowing through with zero code change; only the
  `substanceDeclarations` relation needed an explicit `include: true`
  addition to each.

## What was new

- **`components/dashboard/reach-ppwr/svhc-status-badge.tsx`** —
  `NOT_ASSESSED` (slate, muted) / `NONE_DECLARED` (emerald) /
  `SVHC_PRESENT` (amber) chip. `NOT_ASSESSED` is deliberately its own
  distinct visual state, not defaulted to look like a clean "none
  declared" green — collapsing the two would undo the entire reason
  `SvhcStatus` has three states instead of a boolean.
- **`components/dashboard/reach-ppwr/reach-ppwr-panel.tsx`** — two
  independent forms in one panel component: an SVHC status
  dropdown that reveals a dynamic, add/remove-able substance list (CAS
  number, name, concentration to 4 decimal places, candidate-list date,
  optional safe-use instructions) only when `SVHC_PRESENT` is selected;
  and a PPWR form (recyclability grade, PFAS compliant/non-compliant,
  measured PFAS ppb). Both forms pre-populate from the passport's current
  declaration so re-submitting without changes is a no-op update, not a
  blank form. No Auditor review step in this UI, matching the backend —
  submitting publishes immediately, since this is legally the
  manufacturer's own Article 33 statement, not a certificate an Auditor
  grants.
- **`lib/actions/declare-svhc-status.ts`** / **`declare-ppwr-compliance.ts`**
  — Server Actions, always pass `actor: "ADMIN"` (same as every other
  in-app Server Action in this codebase — `addChainOfCustodyRecordAction`,
  `calculateCarbonFootprintAction`, etc. — since these run from the
  authenticated admin console, not on behalf of an external manufacturer
  API key).
- **`lib/hooks/use-passports.ts`** — `ApiSubstanceDeclaration` /
  `SvhcStatusValue` types, the new fields on `ApiPassport`, and
  `declareSvhcStatus` / `declarePpwrCompliance` hook methods (same
  `refetch()`-after-mutate pattern as every other mutation method here).
- **`batch-details-modal.tsx`** — two new required props
  (`onDeclareSvhc`, `onDeclarePpwr`), threaded through from both
  `app/page.tsx` (legacy Material Ledger) and `app/admin/page.tsx` (the
  guarded admin console) — this modal is shared by both, so both call
  sites needed the same two-line wiring addition.

## Explicitly not built

- Any Auditor review workflow for these declarations (same rationale as
  the backend phase — Article 33 is a manufacturer's own legal statement).
- A dedicated "REACH/PPWR compliance queue" cross-batch dashboard view
  (e.g. "show me every batch still NOT_ASSESSED") — the panel here is
  per-batch, reached through the existing "Manage" action on a batch row.
  A portfolio-wide widget (mirroring `expiry-alert-banner.tsx`'s "everything
  needing attention" rollup) is a natural next step if that visibility gap
  turns out to matter in practice.

## Verification

- `tsc --noEmit` diffed against this project's documented sandbox-only
  baseline: **zero errors** in `reach-ppwr-panel.tsx`, `svhc-status-badge.tsx`,
  `batch-details-modal.tsx`, `use-passports.ts`, `app/page.tsx`, and
  `app/admin/page.tsx`. The two new Server Action files
  (`declare-svhc-status.ts`, `declare-ppwr-compliance.ts`) each show
  exactly one error — the same already-documented `tx` implicit-any
  cascade every other `$transaction`-calling service in this codebase
  shows in this sandbox. The two edited API routes show only their
  pre-existing baseline errors, unchanged by this edit.
- Manual `{`/`}` and `(`/`)` balance check across all ten new/edited
  files — all balanced.
