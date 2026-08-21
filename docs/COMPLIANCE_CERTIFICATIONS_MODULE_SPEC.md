# DPP-Polymer: Compliance & Green Certifications Module — Product Spec & Implementation Plan

> **Document Type:** Product Specification
> **Module:** Certification attachment, verification, and audit trail for polymer batch passports
> **Compliance targets:** EU ESPR (Ecodesign for Sustainable Products Regulation), ISO 14021 (self-declared environmental claims), ISCC PLUS Mass Balance chain-of-custody
> **Status:** Draft for implementation — builds additively on the existing `Certification` model in `prisma/schema.prisma`; no existing fields, models, or live data are removed or altered.

---

## 1. User Story

**As a** polymer manufacturer's Quality Manager,
**I want to** attach one or more recycling/environmental certifications (e.g. ISCC PLUS mass-balance, ISO 14021 self-declaration) to a specific production batch, and see each certificate's verification status,
**so that** the batch's Digital Product Passport carries substantiated, auditable sustainability claims — not just self-declared numbers — before it reaches an EU market surveillance authority, a B2B buyer, or a consumer scanning the QR code.

**Acceptance criteria:**

- A Quality Manager can attach a certification to an existing batch passport (not only at the moment the passport is first created — this is a real gap in the current implementation, see §2.3).
- Every attached certification starts in a `PENDING_REVIEW` state — a manufacturer's own submission is never automatically treated as verified. This mirrors the existing `PolymerPassport.status` pattern, where a newly created passport is `PENDING_VERIFICATION`, not `ISSUED`.
- A separate role (Auditor/Admin — see `lib/rbac.ts`, already referenced in `route.ts`'s existing comments) can move a certification to `VERIFIED` or `REJECTED`, and that action is recorded immutably.
- A consumer scanning the batch's public QR code sees only `VERIFIED` certifications. `PENDING_REVIEW` and `REJECTED` claims are never surfaced as fact on the public-facing page — this is a compliance requirement, not a UI preference: showing an unverified self-declared claim as if it were confirmed risks exactly the kind of unsubstantiated environmental claim ESPR and the EU's broader Green Claims direction are meant to prevent.
- Every state change (added, verified, rejected, expired) is traceable to who did it and when.

---

## 2. Data & Schema Review

### 2.1 What exists today

```prisma
model Certification {
  id            String              @id @default(uuid())
  scheme        CertificationScheme
  certificateId String
  issuingBody   String
  validFrom     DateTime
  validUntil    DateTime
  documentUrl   String?

  passportId String
  passport   PolymerPassport @relation(fields: [passportId], references: [id])

  @@index([passportId])
  @@index([scheme])
}
```

This correctly captures *what the certificate claims* (scheme, ID, issuer, validity window, source document link). It has no concept of *whether anyone has checked it* — every certification in the system today is implicitly "trusted because it was typed in." For an ESPR-facing module, that gap is the whole point of this spec.

### 2.2 Proposed additive fields

All additions below are new, optional-safe fields and one new enum — nothing existing is renamed, retyped, or dropped, consistent with the project's baseline rule.

```prisma
enum CertificationVerificationStatus {
  PENDING_REVIEW
  VERIFIED
  REJECTED
}
```

Deliberately **not** including an `EXPIRED` state in this enum. Expiry is a fact derived from `validUntil` vs. the current date, not a human decision — storing it as a manually-set status invites drift (a cert nobody re-checks stays stuck at `VERIFIED` forever in the stored field, even after `validUntil` passes). Compute "is this certification currently valid" as `verificationStatus === "VERIFIED" && validUntil > now()` wherever it's displayed or checked, and keep the stored enum limited to states a person actually decides.

```prisma
model Certification {
  id            String              @id @default(uuid())
  scheme        CertificationScheme
  certificateId String
  issuingBody   String
  validFrom     DateTime
  validUntil    DateTime
  documentUrl   String?

  // --- NEW: verification workflow -----------------------------------------
  verificationStatus CertificationVerificationStatus @default(PENDING_REVIEW)
  verifiedBy         String? // actor identity, same convention as AuditLog.actor (e.g. "AUDITOR:<uuid>")
  verifiedAt         DateTime?
  rejectionReason    String? // required by the API when moving to REJECTED

  // --- NEW: document integrity ---------------------------------------------
  // Mirrors the recordHash pattern already used on PolymerPassport itself —
  // a SHA-256 of the uploaded/linked certificate document, so a swapped or
  // edited PDF behind an unchanged documentUrl is detectable.
  documentHash String?

  // --- NEW: ISCC PLUS / mass-balance specific ------------------------------
  // Only meaningful when scheme is a mass-balance scheme (ISCC_PLUS,
  // REDCERT2); left null for schemes where it doesn't apply (ISO_14021,
  // EN_15343, etc). Validate conditionally in the Zod schema, not with a
  // DB constraint, to keep the column usable for every scheme.
  massBalanceAllocationPercent Decimal? @db.Decimal(5, 2)

  passportId String
  passport   PolymerPassport @relation(fields: [passportId], references: [id])

  @@index([passportId])
  @@index([scheme])
  @@index([verificationStatus]) // NEW — the admin "pending review" queue filters on this
}
```

### 2.3 The audit trail: reuse `AuditLog`, don't build a parallel system

The project already has a working, tested audit trail (`AuditLog`, written inside the same `$transaction` as every state change — see `lib/audit.ts` and the STEP 5 hardening work on `POST /api/passports`). The right move is to extend it, not duplicate it:

```prisma
enum AuditAction {
  CREATED
  VERIFIED
  REVOKED
  SUPERSEDED
  UPDATED
  // NEW — additive, existing rows and values untouched:
  CERT_ADDED
  CERT_VERIFIED
  CERT_REJECTED
}
```

Adding enum values is a safe, additive Postgres/Prisma change. Every certification event writes an `AuditLog` row scoped to the parent `passportId`, with `metadata: { certificationId, scheme, ... }` — giving you the "digital audit trail link" the ESPR module needs without inventing a second audit system that can drift out of sync with the first.

### 2.4 A real functional gap this surfaces

Today, certifications can only be created inside `POST /api/passports`'s nested `certifications.create` — there is no route to attach a certification to a batch that already exists. The user story above ("attach... to a specific product batch") requires this to work independently of initial passport creation, since real-world certificates (an ISCC PLUS mass-balance cert renewal, a lab's late-arriving ISO 14021 self-declaration) routinely show up after the batch record already exists. §4 below scopes the new endpoint this requires.

---

## 3. UI/UX Flow — Admin Dashboard Component Structure

Following the existing pattern in this codebase (`components/dashboard/`, modal + panel composition, the same visual language as `CreatePassportModal`):

```
components/dashboard/
├── certifications/
│   ├── certification-status-badge.tsx      # Pending / Verified / Rejected / Expired chip — one shared component, color-coded
│   ├── certification-card.tsx              # One cert: scheme, certificateId, issuingBody, validity window, status badge, "View Document" link
│   ├── certifications-panel.tsx            # List of certification-card, inside a passport's detail view; "Add Certification" button; empty state
│   ├── add-certification-modal.tsx         # Form: scheme (enum dropdown), certificateId, issuingBody, validFrom/validUntil, document URL/upload, massBalanceAllocationPercent (shown only when scheme is ISCC_PLUS or REDCERT2)
│   ├── verify-certification-dialog.tsx     # Auditor/Admin-only: Verify / Reject with a required reason on reject
│   └── certification-audit-trail.tsx       # Expandable timeline reading AuditLog filtered to this certificationId — who added/verified/rejected, when
```

**Where it lives in the existing app:**

- **Admin passport detail view** (`app/admin/page.tsx` or a new per-passport detail route) — `CertificationsPanel` renders under each passport's existing metrics section. `AddCertificationModal` is reachable by any authenticated user; `verify-certification-dialog` is only rendered/reachable for the Auditor/Admin role, matching the existing `PATCH /api/passports/[batchId]` role gate already noted in `route.ts`'s comments.
- **Public consumer scan page** (`app/01/[gtin]/21/[serialOrBatch]/page.tsx`, via `PublicScanPage`) — a read-only certification list, **filtered server-side to `verificationStatus === "VERIFIED"` and `validUntil > now`**. This filter belongs in the data-fetching layer, not just hidden in the UI, so a `PENDING_REVIEW` or `REJECTED` claim is never even sent to the browser for a public scan.

---

## 4. Actionable Development Steps

**Phase 1 — Schema (Dev-Architect)**
1. Add `CertificationVerificationStatus` enum and the new `Certification` fields from §2.2; extend `AuditAction` with the three new values from §2.3. Purely additive.
2. `npx prisma db push` against Neon (same workflow already in use for this project), then `npx prisma generate`.

**Phase 2 — Backend (Dev-Architect)**
3. New shared service `lib/services/verify-certification.ts` (same pattern as `lib/services/create-passport.ts`): takes a certificationId + decision (VERIFIED/REJECTED) + actor + optional rejectionReason, updates the row, and writes the `AuditLog` entry in one transaction.
4. New route `PATCH /api/certifications/[id]` — calls the service above, gated to Auditor/Admin (reuse whatever role-check mechanism `lib/rbac.ts` already defines), returns the updated certification.
5. New route `POST /api/passports/[batchId]/certifications` — attaches a certification to an *existing* passport (closing the gap in §2.4), validated with a new `CertificationInputSchema`-based Zod schema (already exists in `lib/types.ts` — reuse it), writes `CERT_ADDED` to `AuditLog`.
6. Update `GET /api/passports` (and the public scan page's data fetch) to filter certifications shown publicly to `VERIFIED` + not-yet-expired, per §3.

**Phase 3 — Frontend (Product-UI-Pitch)**
7. Build the components listed in §3, starting with `certification-status-badge` and `certification-card` (used everywhere else), then `certifications-panel` and `add-certification-modal`, then the Auditor-only `verify-certification-dialog` and `certification-audit-trail`.
8. Wire `certifications-panel` into the admin passport detail view and the read-only variant into the public scan page.

**Phase 4 — Compliance sign-off (Compliance-Legal + QA-Auditor)**
9. Map each stored field to the specific ESPR article/annex and ISO 14021 clause it substantiates (a short traceability table — useful for an actual EU market-surveillance audit, not just internal documentation).
10. RBAC test: confirm a manufacturer account cannot call the verify endpoint on their own submitted certification (mirrors the existing rule that a passport submitter isn't the same actor who marks it `ISSUED`).
11. Confirm the public scan page never renders a `PENDING_REVIEW`/`REJECTED` certification under any query-param or edge-case input (this is the one compliance-critical regression to explicitly test for, since it's a silent, easy-to-reintroduce bug).

---

*No existing schema fields, API routes, or UI components are modified by this plan until each step above is implemented — this document is the spec, not yet the diff.*
