# 4. Technical Architecture Summary

> **Key takeaway:** Every capability described below is live in the production codebase today — a cryptographic hash-chained audit ledger, GS1 Digital Link QR, a multi-role RBAC trust workflow, and PPWR-aware ESG analytics — not a roadmap promise.

**In this document:** [4.1 Why this matters](#41-why-this-matters-to-a-funding-reviewer) · [4.2 Core stack](#42-core-technology-stack) · [4.3 DPP data model](#43-the-digital-product-passport-data-model) · [4.4 Immutability & audit ledger](#44-cryptographic-immutability-and-the-audit-ledger) · [4.5 RBAC & trust model](#45-role-based-access-and-multi-party-trust) · [4.6 ESG analytics](#46-esg-compliance-and-analytics-layer) · [4.7 i18n & accessibility](#47-internationalization-and-accessibility) · [4.8 What this demonstrates](#48-what-this-demonstrates-for-a-grant-application)

> Written for a grant reviewer or non-technical evaluator. It describes what is actually live in the codebase today, not a future plan — every capability named below has been implemented and delivered to the production repository. Where a capability is a near-term extension rather than already shipped, it is explicitly marked "planned."

## 4.1 Why this matters to a funding reviewer

A grant reviewer evaluating a digitalization or circular-economy project typically needs to answer two questions beyond "does the idea make sense": *is there a real, working system behind this application*, and *is the technical approach sound enough to scale and to survive regulatory/security scrutiny*. This section is written to answer both directly, because the platform is not a prototype or mockup — it is a deployed application with a live PostgreSQL database, real API routes, and multiple working user-facing portals.

## 4.2 Core technology stack

- **Database & data layer:** PostgreSQL hosted on Neon (a managed, serverless-friendly Postgres provider), accessed exclusively through Prisma ORM. All regulatory-sensitive numeric fields (recycled content %, melt flow index, density, tensile strength, carbon footprint kg CO2e/kg) are stored as `Prisma.Decimal` types rather than native floating-point numbers — a deliberate engineering choice that avoids the rounding drift that floating-point arithmetic introduces, which matters when a stored figure may end up quoted in a regulatory filing or an auditor's report.
- **Application framework:** Next.js (App Router) with strict TypeScript throughout, following the framework's modern async-route-parameter conventions. The application is organized into modular, reusable components under `components/ui`, `components/dashboard`, and service-layer business logic under `lib/services`, keeping data-mutation logic out of UI code and centrally testable.
- **Hosting model:** deployed on a Vercel-class platform, giving the application automatic scaling for read-heavy traffic (public QR-code scans) without manual infrastructure management — an important cost and operational consideration for an early-stage team.

## 4.3 The Digital Product Passport data model

At the center of the schema is `PolymerPassport` — one row per physical batch — holding GTIN, batch ID, polymer type and grade, ISO 1133 melt flow index, density, tensile strength, recycled content percentage (with PCR/PIR distinction), bio-based content percentage, and a verified carbon footprint figure (`kgCO2ePerKg`), optionally third-party-verified with the verifying body recorded. Every passport carries a `recordHash` (SHA-256) and, once revised, a `previousRecordHash`, so that the record's own history is independently checkable.

Built on top of this core model, and already live:

- **Batch genealogy (traceability):** a `BatchGenealogyLink` join model records which upstream batches were compounded into a downstream batch, with a quantity-used figure — enabling a full, recursive upstream traceability view on the public passport page (a collapsible lineage tree, capped at a bounded depth for query safety), directly supporting supply-chain traceability requirements under ESPR and PPWR.
- **Carbon footprint calculator:** a separate `CarbonFootprintCalculation` model stores an illustrative Scope 1/2/3 estimate (processing + transport emissions), computed by a pure, dependency-free, unit-testable utility function — deliberately kept distinct from the manufacturer's own verified LCA figure, with the estimate always labeled as illustrative wherever it is shown, so an unverified number is never presented to a consumer or auditor as a confirmed fact.
- **Compliance & certification workflow:** a `Certification` model (ISCC PLUS, ISO 14021, EN 15343, REDcert2, and others) with a formal `PENDING_REVIEW → VERIFIED / REJECTED` verification-status lifecycle. Expiry is deliberately *computed at read time* from the certificate's validity window rather than stored as a manually maintained flag, preventing the common failure mode where a stale "verified" status silently outlives the certificate's actual validity.
- **GS1 Digital Link QR resolution:** every issued passport gets a real GS1 Digital Link URI (`/01/{GTIN}/21/{BATCH}`), resolved by a dedicated public route, with a QR-code generation and printable label-sheet suite (standard grid and large industrial-label layouts) for factory-line batch labeling — meeting the GS1 standard the DPP mandate itself points to for physical-to-digital linking.

## 4.4 Cryptographic immutability and the audit ledger

Every consequential state change in the system — passport creation, verification, revocation, certification decisions, carbon calculations, chain-of-custody review, and more — is written to an append-only `AuditLog` inside the same database transaction as the change itself. Each log entry is SHA-256 hashed over its own fields plus the previous entry's hash, forming a single, global, insertion-ordered hash chain — the same structural principle blockchains use for tamper-evidence, applied here without the overhead or complexity of a distributed ledger, since a single trusted operator (the platform) plus published, independently verifiable hashes is sufficient for this use case.

Two independent layers of protection follow from this: a live, on-demand integrity-verification function that walks the entire ledger and mathematically proves whether any row has been altered, deleted, or reordered since it was written; and, at the database layer, an append-only trigger that rejects any `UPDATE` or `DELETE` against the audit table outright, so tampering is blocked even in the case of a compromised application-layer credential. A dedicated Audit Log interface lets an administrator or auditor filter, page through, and export the full chronological trail — including a compliance-export workbook that runs a live integrity check at the moment of export and stamps the result into the file, so a regulator opening the export does not have to trust the UI's word for it.

## 4.5 Role-based access and multi-party trust

The platform is built around a genuine multi-party trust model, not a single-tenant admin tool:

- **Manufacturers** create and manage their own batch passports and attach certifications through role-gated write routes.
- **Independent auditors** each hold their own individually issued cryptographic credential (not a shared role key) — because a formal verification sign-off is only meaningful if it is attributable to one identifiable, professionally accountable person — and review submitted passports and certifications through a dedicated Auditor Portal, with every decision permanently recorded in the audit ledger.
- **B2B buyers** access their own purchased-batch portfolio through a dedicated, versioned Buyer API and read-only Customer Portal, designed for stable long-term integration into a buyer's own ERP/CSRD reporting pipeline.
- **Upstream raw-material suppliers** can be invited via a token-based, self-service submission flow to submit their own batch/material data for admin review, without requiring full platform accounts — closing a real supply-chain-onboarding gap that a login-only system would leave open.
- **Consumers** scanning the public QR code see only verified, publicly appropriate data — the platform enforces this filtering server-side, not just in the UI, so unverified claims are never even transmitted to a public request.

Role-based access is enforced both at the API layer (per-route authorization checks) and, following a security hardening pass, at the page-routing layer for every admin sub-route, closing an early gap where role checks existed only on specific mutating API calls rather than on page access itself.

## 4.6 ESG, compliance, and analytics layer

Built on top of the core passport and certification data — computed fresh on every request rather than cached or separately stored, so it can never disagree with the underlying records — the platform provides: PCR/PIR mass tracking and an illustrative EU plastic-tax exposure estimate; a certification compliance breakdown with live-computed expiry alerting; a transparent, weighted Sustainability Readiness Index; PPWR 2030/2040 recycled-content target tracking benchmarked against the regulation's published Article 7 thresholds; manufacturer and material-grade distribution analytics; and a supplier performance/compliance ranking dashboard. Every computed score shows its full component breakdown and weighting rather than a bare number, so the methodology is auditable by the manufacturer's own compliance team, not a black box.

## 4.7 Internationalization and accessibility

The public-facing passport page is localized (English/German/French implemented, with a documented pattern for adding further languages), with data values (batch IDs, hashes, certification scheme names) deliberately left untranslated to avoid ambiguity in a regulatory-facing document, while UI labels are fully translated — relevant given NRW's own linguistic context and the platform's EU-wide addressable market.

## 4.8 What this demonstrates for a grant application

Taken together, Sections 4.2–4.7 describe a system that already implements the hard, non-obvious parts of a compliant DPP platform — cryptographic tamper-evidence, a genuine multi-party verification workflow, GS1-standard physical-to-digital linking, and regulatory-target-aware analytics — rather than a plan to build them. For a grant program evaluating technical feasibility and execution capability (a standard criterion across NRW.BANK and EFRE.NRW innovation programs), this is the strongest available evidence: working software, in a live database, with a documented, additive engineering history that has not broken or removed a single previously shipped capability across many delivered feature phases.

**Planned, not yet built (for transparency in any application that asks about roadmap):** production-grade session authentication for the manufacturer/admin console (the current interim mechanism uses shared per-role API keys, adequate for a pilot but flagged internally as needing a full session-auth system before wider commercial rollout); a first-class batch-weight field to make mass-based ESG metrics complete across all batches rather than only those where the carbon calculator was run; and formal third-party security/penetration review of the RBAC and cryptographic ledger implementation ahead of handling data for external paying customers at scale.
