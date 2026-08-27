# Portfolio-Wide SVHC Compliance Alert Banner

Follow-up to `claude/reach-ppwr-dashboard-ui-notes.md`'s "Explicitly not
built" note: a portfolio-wide rollup of batches still `NOT_ASSESSED` for
REACH Article 33, "mirroring `expiry-alert-banner.tsx`'s 'everything
needing attention' rollup."

## What already existed and was reused untouched

- **`components/dashboard/expiry-alert-banner.tsx`'s architecture** —
  fetch-on-mount from a dedicated aggregation route, `SummaryChip`
  sub-component, expand/collapse detail table, loading-skeleton and
  error-with-retry states, severity-tinted outer container. The new
  `SvhcComplianceBanner` follows this shape closely.
- **`app/api/certifications/expiry-alerts/route.ts`'s route
  convention** — `export const dynamic = "force-dynamic"`, plain
  unauthenticated `GET()`, `{success, data}` / `{success, error}` shape.
  Mirrored exactly by the new `GET /api/passports/svhc-alerts`.
- **`lib/services/expiry-alert-service.ts`'s aggregation-service shape**
  — `EXCLUDED_PASSPORT_STATUSES` (REVOKED/SUPERSEDED excluded from a
  live "needs attention" widget), `MAX_ROWS_PER_TIER` with explicit
  `*Truncated` flags (never a silent cap). Mirrored by the new
  `lib/services/svhc-compliance-service.ts`.
- **`GET /api/passports/{batchId}`** — used as-is by the banner's
  "Manage" action; no changes needed.

## What was new

- **`lib/services/svhc-compliance-service.ts`** —
  `computePortfolioSvhcSummary()`. Two tiers, not three:
  `notAssessed` (the actionable gap this widget exists for) and
  `svhcPresent` (informational — the declaration IS on file, but worth
  portfolio-wide visibility). `NONE_DECLARED` is deliberately excluded
  — it's the fully-resolved state the widget is trying to help reach,
  so listing every "all clear" batch would bury the signal.
- **`app/api/passports/svhc-alerts/route.ts`** — thin `GET` wrapper,
  same public/unauthenticated rationale as the expiry-alerts route
  (every figure here is already derivable from `GET /api/passports`'s
  own unauthenticated response).
- **`components/dashboard/reach-ppwr/svhc-compliance-banner.tsx`** —
  `SvhcComplianceBanner({ onManageBatch })`. Two differences from
  `ExpiryAlertBanner`, both intentional:
  - No "Run Check Now" — there's no background check to (re-)trigger;
    `svhcStatus` is a manufacturer declaration set directly, so this
    widget just reflects current state, always live.
  - No per-row "Acknowledge" — only "Manage". There's no acknowledgment
    concept for an SVHC declaration gap; the actionable step is opening
    the batch's existing REACH & PPWR panel and declaring/updating its
    status.

## The pagination correctness fix (not a new bug, but this feature would have hit it)

`usePassports()` fetches `GET /api/passports` with no `page`/`pageSize`
params, so it only ever holds page 1 (default 25) of the portfolio. A
portfolio-wide widget can legitimately point at a `NOT_ASSESSED` batch
outside that page, so:

- **`SvhcComplianceBanner`'s "Manage" button fetches
  `GET /api/passports/{batchId}` itself**, independent of the parent
  page's paginated list, and hands the full `ApiPassport` object up via
  `onManageBatch`.
- **`app/admin/page.tsx`**: `manageTarget` was already a full
  `ApiPassport | null` (not just an id), but the modal's `passport`
  prop derivation was `passports.find(...) ?? null` — silently
  dropping to `null` (and failing to open) for any batch outside page
  1. Changed the fallback to `?? manageTarget`, i.e. the already-held
  object, so "Manage" from this banner (or any future portfolio-wide
  widget) works regardless of pagination. This is a general
  correctness fix, not banner-specific.

## Deliberate divergence from the original plan: `app/admin/page.tsx` only

The plan going into this feature was to render the banner in both
`app/admin/page.tsx` and `app/page.tsx`, alongside a matching
pagination-fallback fix in `app/page.tsx` (which only holds a bare
`manageTargetId: string | null`, not a full object).

Checking `app/page.tsx` before implementing that showed neither
`ExpiryAlertBanner` nor `SupplierReviewPanel` — the two existing
portfolio-wide "needs attention" widgets — are rendered there at all.
`app/page.tsx` is the legacy Material Ledger dashboard (KPI cards +
table); portfolio-wide compliance/ops widgets are established as
admin-console-only (`app/admin/page.tsx`, "the guarded admin console"
per the prior sprint's notes). Adding `SvhcComplianceBanner` to
`app/page.tsx` would have been the first portfolio-wide widget there,
breaking that existing separation rather than following it.

`SvhcComplianceBanner` was therefore added to `app/admin/page.tsx`
only, matching where `ExpiryAlertBanner` and `SupplierReviewPanel`
already live. `app/page.tsx` was left untouched — no pagination fix
was needed there either, since nothing in that file triggers an
off-page "Manage" click. If a future sprint wants this visibility on
the legacy dashboard too, the same `manageTargetSnapshot`-style fix
sketched for it earlier would still be the right shape; it just wasn't
needed by this feature as scoped.

## Explicitly not built

- Any change to how `svhcStatus` is set — this is a read-only rollup
  over the existing `declareSvhcStatus` write path.
- A portfolio-wide PPWR widget — the user's request was specifically
  about `NOT_ASSESSED` SVHC visibility; PPWR fields are all optional
  and don't have an equivalent "missing declaration" semantics the same
  way (no default/required status field), so a PPWR rollup would need
  its own design pass if wanted later.

## Verification

- `tsc --noEmit`: zero errors in all four new/edited files
  (`svhc-compliance-service.ts`, `app/api/passports/svhc-alerts/route.ts`,
  `svhc-compliance-banner.tsx`, `app/admin/page.tsx`) — the rest of the
  158 reported errors match this sandbox's documented pre-existing
  `@prisma/client`-unresolved-import baseline (confirmed by file name:
  every error is in a file untouched by this feature).
- Manual `{`/`}`, `(`/`)`, `[`/`]` balance check across all four files —
  all balanced.
