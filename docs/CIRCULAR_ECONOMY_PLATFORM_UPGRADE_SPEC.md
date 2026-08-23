# DPP-Polymer: Circular Economy Platform Upgrade — Implementation Plan

> **Document Type:** Product & Technical Specification
> **Scope:** 4 enterprise features — Batch Genealogy, Carbon Footprint Calculator, PDF Certificate Export, Compliance Expiry Alerts
> **Status:** Draft plan for review. Nothing in this document has been applied to `schema.prisma` or the live app yet — matches how the Compliance & Certifications Module was handled (spec reviewed first, then implemented phase-by-phase against the real files).

---

## Before the plan: one finding that changes the scope

**Feature 4 (Compliance Expiry Alerts) needs zero schema changes.** The request asks to "update the database schema to include an `expiryDate`" — but `Certification.validUntil` already *is* that field, added when we built the Compliance & Green Certifications Module. `verificationStatus` and the audit trail also already exist. Feature 4 is pure query + Admin UI work, not a migration. Scoping it as a schema task would have meant either duplicating an existing column under a new name (bad — two sources of truth for the same fact) or discovering this mid-implementation. Section 4 below reflects the real (smaller) scope.

That leaves three features that do need schema work, covered in order below.

---

## 1. Updated Database Schema

All additions are new models/fields — nothing in `schema.prisma` is renamed, retyped, or removed, consistent with the project's baseline rule.

### 1.1 Feature 1 — Batch Genealogy (Parent Batches)

A batch can be compounded from *multiple* upstream batches (e.g. a PP grade blending two different recycled feedstock lots), and in principle one upstream batch could feed multiple downstream batches — this is a genuine many-to-many relationship, not a single `parentId` column. Modeled as an explicit join table (matching this codebase's existing preference for explicit models like `GS1DigitalLink` over Prisma's implicit many-to-many, so the link itself can carry data and an audit trail):

```prisma
model BatchGenealogyLink {
  id String @id @default(uuid())

  parentPassportId String
  parentPassport   PolymerPassport @relation("GenealogyParent", fields: [parentPassportId], references: [id])

  childPassportId String
  childPassport   PolymerPassport @relation("GenealogyChild", fields: [childPassportId], references: [id])

  quantityUsedKg Decimal? @db.Decimal(10, 3) // how much of the parent batch went into this child batch
  notes          String?

  createdAt DateTime @default(now())

  @@unique([parentPassportId, childPassportId])
  @@index([parentPassportId])
  @@index([childPassportId])
}
```

Add to `PolymerPassport`:
```prisma
parentLinks BatchGenealogyLink[] @relation("GenealogyChild")  // this batch's upstream inputs
childLinks  BatchGenealogyLink[] @relation("GenealogyParent") // downstream batches made from this one
```

**Cycle prevention is application logic, not a DB constraint.** Before inserting a link, walk the proposed parent's own ancestor chain and reject if the new child already appears in it — otherwise a batch could end up as its own ancestor, which would make the genealogy tree query recurse forever. This check belongs in the service function (§2.1), not the schema.

### 1.2 Feature 2 — Carbon Footprint Calculator

`PolymerPassport.carbonFootprintKgCO2ePerKg` already exists — it represents the manufacturer's own figure, optionally third-party-verified (`lcaThirdPartyVerified`, `lcaVerifierName` already exist alongside it). The new calculator produces a **separate, clearly-labeled rough estimate**, not a replacement for that verified figure — see the compliance caveat in §4.1 for why conflating the two is a real risk, not just a style choice. Modeled as its own table so each calculation carries its own inputs and provenance (which emission-factor version produced it):

```prisma
enum TransportMode {
  TRUCK
  RAIL
  SEA
  AIR
}

model CarbonFootprintCalculation {
  id String @id @default(uuid())

  passportId String          @unique
  passport   PolymerPassport @relation(fields: [passportId], references: [id])

  weightKg             Decimal       @db.Decimal(10, 3)
  transportDistanceKm  Decimal       @default(0) @db.Decimal(10, 2)
  transportMode        TransportMode @default(TRUCK)

  scope1KgCO2e Decimal @db.Decimal(10, 3) // on-site processing (direct)
  scope2KgCO2e Decimal @db.Decimal(10, 3) // purchased energy for processing
  scope3KgCO2e Decimal @db.Decimal(10, 3) // transport/logistics
  totalKgCO2e  Decimal @db.Decimal(10, 3)

  emissionFactorVersion String   @default("illustrative-v1-2026") // ties a stored result to the exact factor table that produced it, so results stay explainable after factors are later updated
  calculatedAt           DateTime @default(now())
}
```

`@@unique([passportId])` (via `passportId` alone being unique) keeps this MVP-simple as "latest calculation only." If you later want a history of recalculations as inputs change, drop the `@unique` and add `@@index([passportId, calculatedAt])` — noted here rather than built now, since nothing in the current request asks for history.

### 1.3 Feature 3 — PDF Certificate Export

No schema change is required to *generate* the PDF — it's a stateless render from data that already exists (passport fields, certifications, GS1 link, record hash). Optionally, if you want an audit record of "a certificate was issued and exactly what hash it attested to at that moment" (useful if the underlying data changes later and you need to know what a previously-downloaded PDF actually said), add two optional fields to `PolymerPassport`:

```prisma
// Optional — only add if you want certificate-issuance provenance:
lastCertificatePdfHash     String?   // SHA-256 of the generated PDF bytes
lastCertificateGeneratedAt DateTime?
```

Recommendation: **skip this for the first pass.** Keep PDF generation fully on-demand/stateless initially; add provenance tracking later if an actual audit need for it shows up, rather than speculatively growing the schema now.

### 1.4 Feature 4 — Compliance Expiry Alerts

No schema change (see the finding at the top). This is a read query against `Certification.validUntil` + `verificationStatus`, plus an Admin UI to surface it — scoped fully in §2.4 and §3.4.

---

## 2. Admin/Manufacturer Input Form — UI & API

### 2.1 Batch Genealogy

- **API:** `POST /api/passports/[batchId]/parents` — body `{ parentBatchId: string, quantityUsedKg?: number, notes?: string }`. Service function `lib/services/link-batch-genealogy.ts`: resolves both batchIds to internal ids, runs the cycle check from §1.1 (walk `parentBatchId`'s ancestors via `parentLinks`, reject if the target child appears), creates the `BatchGenealogyLink`, writes an `AuditLog` entry (new `AuditAction.GENEALOGY_LINKED` value, additive like the certification actions). Gated `authorize(req, ["MANUFACTURER", "ADMIN"])`, matching every other write route.
- **UI:** In `CreatePassportModal` (and a new "Manage Genealogy" panel for existing batches, since — matching Feature-4-style reasoning — genealogy links, like certifications, need to attach *after* a batch already exists, not only at creation): an autocomplete/searchable multi-select over `GET /api/passports?search=...` to pick parent batch(es) by `batchId` or `grade`, each with an optional `quantityUsedKg` input.

### 2.2 Carbon Footprint Calculator

- **API:** `POST /api/passports/[batchId]/carbon-footprint` — body `{ weightKg: number, transportDistanceKm?: number, transportMode?: TransportMode }`. Service `lib/services/calculate-carbon-footprint.ts` calls the pure utility (§4.1), persists the result (upsert on `passportId`), writes `AuditLog` (`CARBON_CALCULATED`). Same RBAC gate as above.
- **UI:** New fields in `CreatePassportModal` (and the same "attach after creation" pattern as genealogy): Weight (kg), Transport Distance (km), Transport Mode (select: Truck/Rail/Sea/Air). A live preview of the Scope 1/2/3 breakdown as the user types, computed client-side by calling the same pure utility function (it's dependency-free, so it can run identically in the browser and on the server — no duplicate logic to keep in sync).

### 2.3 PDF Certificate Export

No admin-side input needed — this reads existing data. (Covered fully in §3.3 since the button/flow lives on the public/passport view.)

### 2.4 Compliance Expiry Alerts

- **API:** Extend `GET /api/passports` with a computed flag per row (not stored) — `certificationAlert: "EXPIRED" | "EXPIRING_SOON" | null`, derived server-side from each passport's `certifications[].validUntil` compared against `now()` and `now() + 30 days`. No new endpoint needed; this is computed in the existing route's response mapping.
- **UI:** Admin dashboard table gets a status column/badge: red "Expired" or amber "Expiring in N days" next to any batch with an affected certification, sortable/filterable to a "Needs Attention" view. Pure presentation — no new write path.

---

## 3. Public Passport Interface

### 3.1 Batch Genealogy — Lineage View

On `app/01/[gtin]/21/[serialOrBatch]/page.tsx` / `PublicScanPage`: a new `BatchLineageTree` component. Fetch the passport's `parentLinks` (and recursively their own `parentLinks`, capped at a sane depth — e.g. 5 levels — to keep the query bounded) via a new `GET /api/passports/[batchId]/genealogy` read endpoint (public, no RBAC — same trust level as the rest of the public scan page). Render as a nested, collapsible list (simpler and more accessible than a canvas-drawn tree — keyboard-navigable, screen-reader-friendly out of the box) showing each ancestor's `batchId`, `polymerType`, `recycledContentPercent`, and a link to its own public passport page.

### 3.2 Carbon Footprint Calculator — Display

A `CarbonFootprintCard` on the public page showing the **verified** LCA figure (`carbonFootprintKgCO2ePerKg`, already existing) as the primary, prominent number — that's the one with actual substantiation behind it (`lcaThirdPartyVerified`). The new Scope 1/2/3 breakdown from `CarbonFootprintCalculation` is shown as a secondary, clearly-labeled **"Estimated breakdown (illustrative)"** disclosure, not given equal visual weight — see §4.1's compliance caveat for exactly why this ordering matters.

### 3.3 PDF Certificate Export

- **Button:** "Download Official Certificate" on the public passport page, next to the existing QR/verification info.
- **Endpoint:** `GET /api/passports/[batchId]/certificate.pdf` — streams a generated PDF (`Content-Type: application/pdf`). No RBAC needed (same public data already on the page — the PDF is just a formatted export of it, not a new disclosure).
- **Content:** batch identification (GTIN, batchId, polymer type/grade), mass balance data (recycled/bio-based %, sources), **only `VERIFIED` certifications** (same rule as the live page — a PDF is just another rendering of the same data, so it inherits the same "never present unverified as fact" constraint from the Compliance module), the record hash, and an embedded QR code (regenerate via the `qrcode` package already a dependency) pointing back to the live verification URL — so a printed/saved PDF is always re-checkable against the live record, not just a static snapshot someone could alter.

### 3.4 Compliance Expiry Alerts

Public-facing effect: none directly (this is an admin/internal tool) — except indirectly, since a certification whose `validUntil` has passed should already be excluded from "currently valid" certifications shown publicly, per the existing rule from the Compliance module (§3 of that spec: verified + not-expired only). Worth a regression check that this still holds once the admin alerting UI is in place.

---

## 4. Utility Functions

### 4.1 Carbon Footprint Calculator (`lib/utils/carbon-footprint-calculator.ts`)

Pure, dependency-free, runs identically client- and server-side — no Prisma/network calls inside it, so it's trivially unit-testable and safe to call for a live preview as the admin types.

**Compliance caveat — read before wiring this into the UI:** the emission factors below are illustrative placeholder defaults for a quick estimate, not a licensed/certified emission-factor database (ecoinvent, DEFRA, etc.). Per the same principle established for certifications — never present an unverified figure to a consumer as confirmed fact — this function's output must always be labeled as an estimate wherever shown (§3.2), and must **never** silently overwrite `PolymerPassport.carbonFootprintKgCO2ePerKg`, which represents the manufacturer's own, possibly third-party-verified LCA figure. Swap `PROCESSING_EMISSION_FACTORS`/`TRANSPORT_EMISSION_FACTORS` for a real licensed source before using this for anything beyond an internal rough estimate.

```typescript
export type PolymerTypeForCarbon =
  | "PET" | "HDPE" | "PVC" | "LDPE" | "PP" | "PS" | "PLA" | "PHA" | "PA" | "PC" | "ABS" | "OTHER";

export type TransportMode = "TRUCK" | "RAIL" | "SEA" | "AIR";

/**
 * Rough processing (Scope 1: on-site direct + Scope 2: purchased energy)
 * emission factors, kg CO2e per kg of material PROCESSED (compounding/
 * recycling only — NOT virgin-resin production). Illustrative mid-range
 * defaults; replace with a licensed factor database before relying on
 * these for anything beyond an internal estimate.
 */
const PROCESSING_EMISSION_FACTORS: Record<PolymerTypeForCarbon, { scope1: number; scope2: number }> = {
  PET:   { scope1: 0.18, scope2: 0.22 },
  HDPE:  { scope1: 0.15, scope2: 0.19 },
  PVC:   { scope1: 0.20, scope2: 0.24 },
  LDPE:  { scope1: 0.16, scope2: 0.20 },
  PP:    { scope1: 0.15, scope2: 0.19 },
  PS:    { scope1: 0.19, scope2: 0.23 },
  PLA:   { scope1: 0.12, scope2: 0.16 },
  PHA:   { scope1: 0.13, scope2: 0.17 },
  PA:    { scope1: 0.24, scope2: 0.28 },
  PC:    { scope1: 0.26, scope2: 0.30 },
  ABS:   { scope1: 0.21, scope2: 0.25 },
  OTHER: { scope1: 0.18, scope2: 0.22 },
};

/** Rough freight emission factors, kg CO2e per tonne-km. Illustrative. */
const TRANSPORT_EMISSION_FACTORS: Record<TransportMode, number> = {
  TRUCK: 0.10,
  RAIL:  0.03,
  SEA:   0.015,
  AIR:   0.60,
};

export const EMISSION_FACTOR_VERSION = "illustrative-v1-2026";

export interface CarbonFootprintInput {
  polymerType: PolymerTypeForCarbon;
  weightKg: number;
  transportDistanceKm?: number;
  transportMode?: TransportMode;
}

export interface CarbonFootprintBreakdown {
  scope1KgCO2e: number;
  scope2KgCO2e: number;
  scope3KgCO2e: number;
  totalKgCO2e: number;
  perKgCO2e: number;
  emissionFactorVersion: string;
}

export function calculateCarbonFootprint(input: CarbonFootprintInput): CarbonFootprintBreakdown {
  const { polymerType, weightKg, transportDistanceKm = 0, transportMode = "TRUCK" } = input;

  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error("weightKg must be a positive number");
  }
  if (!Number.isFinite(transportDistanceKm) || transportDistanceKm < 0) {
    throw new Error("transportDistanceKm must be zero or a positive number");
  }

  const factors = PROCESSING_EMISSION_FACTORS[polymerType] ?? PROCESSING_EMISSION_FACTORS.OTHER;
  const transportFactor = TRANSPORT_EMISSION_FACTORS[transportMode];

  const scope1KgCO2e = round3(factors.scope1 * weightKg);
  const scope2KgCO2e = round3(factors.scope2 * weightKg);
  const scope3KgCO2e = round3(transportFactor * (weightKg / 1000) * transportDistanceKm); // tonne-km
  const totalKgCO2e = round3(scope1KgCO2e + scope2KgCO2e + scope3KgCO2e);

  return {
    scope1KgCO2e,
    scope2KgCO2e,
    scope3KgCO2e,
    totalKgCO2e,
    perKgCO2e: round3(totalKgCO2e / weightKg),
    emissionFactorVersion: EMISSION_FACTOR_VERSION,
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
```

This exact file is ready to add as-is — it has no dependency on anything else in the repo, so it carries zero integration risk. It's included here in full rather than deferred to implementation, unlike the route/component work below.

### 4.2 PDF Generation (`lib/services/generate-certificate-pdf.ts`)

**Recommended library: `@react-pdf/renderer`**, not `jspdf`. Reasoning: it lets the certificate be authored as JSX components (consistent with the rest of this Next.js codebase, easy for `@Product-UI-Pitch` work to iterate on layout), renders fully server-side inside the API route (no client bundle weight, no browser canvas quirks), and produces properly laid-out multi-section documents more cleanly than `jsPDF`'s imperative drawing API.

**Structure (to be written against the real current data shapes once we implement this phase):**
- `lib/services/generate-certificate-pdf.ts` — takes a full passport record (with `certifications` filtered to `VERIFIED`, `manufacturer`, `gs1Link`), renders a `@react-pdf/renderer` document to a `Buffer`.
- `app/api/passports/[batchId]/certificate.pdf/route.ts` — fetches the passport, calls the generator, returns `new NextResponse(pdfBuffer, { headers: { "Content-Type": "application/pdf", "Content-Disposition": \`attachment; filename="DPP-${batchId}.pdf"\` } })`.
- QR embed: reuse the existing `qrcode` package (already a `package.json` dependency) to generate a PNG data URL of the verification URL, pass it into the PDF document as an `<Image>`.

---

## 5. What's next

This document is the plan — matching how the Compliance & Certifications Module worked, nothing above has touched `schema.prisma`, any route, or any component yet, **except** §4.1's carbon calculator utility, which is safe to add verbatim since it's a new, self-contained, zero-dependency file.

Given the size of this request (four substantial features, each comparable in scope to the entire Certifications module we just shipped in three phases), I'd recommend implementing them the same way we did that one: one feature at a time, reading the real current `CreatePassportModal.tsx`, `PublicScanPage.tsx`, and `admin/page.tsx` before touching them (rather than generating UI code now against files I haven't re-read in this session, which is exactly the failure mode this project hit early on before we had direct repo access).

Suggested order, following your own numbering: **Feature 1 (Batch Genealogy schema) → Feature 2 (Carbon Calculator schema + the utility above) → Feature 4 (Admin expiry alerts — smallest, no schema, quick win) → Feature 3 (PDF export — biggest, benefits from the other three being in place first, e.g. showing genealogy/carbon data on the certificate too).** Let me know if you'd rather reorder, and which one to start on.
