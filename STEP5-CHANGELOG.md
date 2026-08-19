# Step 5 — Database & API Integration Hardening

## Critical finding: two conflicting `/app/api/passports/route.ts` drafts

The uploaded codebase contained two different implementations of the same
route file:

1. **Unvalidated draft** — `new PrismaClient()` per request (no singleton),
   random non-check-digit GTINs, a hard-coded `carbonFootprintKgCO2ePerKg`
   of `1.25` regardless of input, no Zod validation, no hashing, no GS1
   link, and a `GET` that swallowed every DB error behind a fake
   `{ success: true, data: [] }` response.
2. **Zod-validated draft** — `lib/prisma` singleton, full schema validation,
   manufacturer/batch checks, a real SHA-256 `recordHash`, and a GS1
   Digital Link, but no `GET` handler and no audit trail.

**Resolution:** draft 2 is kept as the canonical base. `GET` is now a
proper paginated/filterable endpoint that reports real errors as real
errors, and `POST` now also writes a `CREATED` audit log entry inside the
same transaction as the passport insert. Draft 1's logic must not be
reintroduced — do not merge it back in.

## What changed (all additive to the existing schema — nothing removed)

- **`prisma/schema.prisma`** — added `AuditLog` model, `AuditAction` enum,
  an `auditLogs` back-relation on `PolymerPassport`, and a
  `@@index([manufacturerId])`. Every existing field, model, enum, and
  index is untouched.
- **`lib/prisma.ts`** — Prisma Client singleton (was referenced by the
  validated draft but not present in the upload).
- **`lib/types.ts`** — `PolymerPassportInputSchema` / `CertificationInputSchema`
  (Zod), GS1 mod-10 GTIN check-digit validation, `hashRecord` (canonical
  SHA-256 over sorted-key JSON, `Prisma.Decimal`-aware), and
  `computeTotalRecycledPercent`.
- **`lib/qr.ts`** — `buildGs1VerificationUrl(gtin, batchId, recordHash)`.
- **`lib/rbac.ts`** — interim API-key RBAC (`x-dpp-api-key` header,
  timing-safe compare) gating the new verify/revoke endpoint. This is a
  real, enforced boundary, not a stub — it stands in until session-based
  auth lands.
- **`lib/audit.ts`** — `writeAuditLog`, always called inside the same
  `$transaction` as the mutation it records.
- **`app/api/passports/route.ts`** — canonical `GET` (pagination, status /
  polymerType / manufacturerId / search filters, real error responses)
  and `POST` (validate → check manufacturer → check batch uniqueness →
  hash → GS1 link → transactional create + audit log).
- **`app/api/passports/[batchId]/route.ts`** — new. `GET` for single-batch
  lookup (consumer QR scan + B2B detail view) and `PATCH` for the
  PENDING_VERIFICATION → ISSUED/REVOKED (and ISSUED → REVOKED/SUPERSEDED)
  transition, gated to AUDITOR/ADMIN, re-sealing `recordHash` and chaining
  `previousRecordHash`.
- **`lib/hooks/use-passports.ts`** — client data layer: loading/error
  state, `refetch`, `createPassport` (throws `PassportValidationError`
  with structured `fieldErrors` on a 400 response).
- **`lib/hooks/use-toast.tsx`** — dependency-free toast provider/hook.
- **`components/dashboard/passport-skeleton.tsx`** — loading skeletons for
  the card grid and ledger table.
- **`components/dashboard/create-passport-modal.tsx`** — the dashboard had
  a QR/GS1 "studio" tab but no actual way to create a passport against the
  API. This form POSTs to `/api/passports` with per-field validation
  errors mapped from the server response.
- **`app/page.tsx`** — mock `passports` array replaced with live data from
  `usePassports()`; added loading skeletons, an error banner with retry,
  a "New Passport" button + modal, a manual refresh button, and wired the
  QR modal to the real `qrCodePayloadUrl` / `recordHash` fields. Trimmed
  ~18 unused `lucide-react` icon imports left over from the original
  draft. KPI cards now compute from real data instead of showing
  fabricated numbers (`1,252`, `+12.4%`, `3,410`, `18.4k Tons` were all
  hard-coded in the original file) — the monthly trend chart still uses
  illustrative sample data (no time-series endpoint exists yet) but now
  says so in its subtitle instead of implying it's live.

## Environment variables to add

```
DPP_PUBLIC_BASE_URL=https://dpp.polymer.eu      # or your real domain
DPP_MANUFACTURER_API_KEY=<generate a long random secret>
DPP_AUDITOR_API_KEY=<generate a long random secret>
DPP_ADMIN_API_KEY=<generate a long random secret>
```

`DATABASE_URL` is untouched — the existing Neon connection logic was not
modified.

## Migration required

```bash
npx prisma migrate dev --name step5_audit_log_and_indexes
```

This only adds the `AuditLog` table, the `AuditAction` enum, and one index
— it does not alter any existing column or table.

## Known follow-ups (explicitly out of scope for this pass)

- **Auth**: `POST /api/passports` still trusts `manufacturerId` from the
  request body (see the `TODO(auth)` comment in that file). The
  `x-dpp-api-key` RBAC added here only covers the verify/revoke endpoint.
  Real session auth should replace both.
- **Manufacturer management API**: there's no `GET/POST /api/manufacturers`
  yet, so `CreatePassportModal` asks for a manufacturer UUID directly
  instead of a picker. Worth its own pass.
- **Analytics endpoint**: the dashboard trend chart is still sample data;
  a real `/api/passports/analytics` time-series aggregation would replace
  it.
- **Unused icon imports**: `app/page.tsx`'s import list was trimmed to
  what's actually used; the same sweep hasn't been done on any other
  Step 4 files that weren't touched here.
