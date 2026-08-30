# 1. Executive Summary & Value Proposition

## 1.1 The problem

Europe's polymer value chain is being forced, in a short window, to prove things it has historically never had to prove: exactly how much recycled or bio-based content is in a given batch of resin, where that feedstock came from, what its carbon footprint is, and whether every claim on the label is independently verifiable rather than self-declared. The EU's Ecodesign for Sustainable Products Regulation (ESPR), the Packaging and Packaging Waste Regulation (PPWR, (EU) 2025/40), and the broader Digital Product Passport mandate turn "trust us" sustainability marketing into a hard compliance requirement with legal exposure attached — the EU's Green Claims direction explicitly targets unsubstantiated environmental claims.

For polymer compounders, recyclers, and converters — an industry segment heavily concentrated in NRW's Rhein-Ruhr and Rhineland chemical corridor — this creates an operational problem that spreadsheets and PDFs cannot solve at scale: mass-balance chain-of-custody (ISCC PLUS, REDcert2) has to be tracked batch-by-batch, certifications have to expire and get re-verified on a schedule, carbon footprint figures have to be distinguishable from marketing estimates, and every one of these facts has to be exposed through a QR-code-scannable, GS1-Digital-Link-compliant passport by the time ESPR's delegated acts start applying to plastics value chains.

Most mid-sized polymer processors — the Mittelstand backbone of NRW's chemical and plastics cluster — have neither the software engineering capacity nor the regulatory staff to build this themselves, and the generic ERP/PLM vendors serving this space were not built around DPP-specific data models (mass-balance percentages, MFI/density/tensile specs, cryptographically sealed batch records, GS1 resolver URIs).

## 1.2 What we have built

Polymer DPP is a working, deployed SaaS platform — not a concept — that gives polymer manufacturers, recyclers, and compounders a purpose-built Digital Product Passport system:

- **Industrial-grade material data capture**: ISO 1133 Melt Flow Index, density, tensile strength, PCR/PIR recycled content percentages, bio-based content, and PEF/LCA-based carbon footprint (kg CO2e/kg), stored with exact decimal precision (no floating-point rounding drift on regulatory numbers).
- **Multi-party trust workflow**: manufacturers submit batch data; independent third-party auditors — each individually identified and holding their own cryptographic credential — formally verify or reject it; every certification (ISCC PLUS, ISO 14021, EN 15343, REDcert2) goes through the same pending-review-to-verified lifecycle before it is ever shown to a downstream buyer or consumer as fact.
- **Cryptographic immutability**: every batch record is SHA-256 sealed, and every state change (creation, verification, revocation, certification decision) is written to an append-only, hash-chained audit ledger with a live integrity-verification function — so a regulator or auditor can mathematically prove the record has not been altered, not just take the platform's word for it.
- **Consumer- and auditor-facing transparency**: a GS1 Digital Link-compliant QR code (`/01/{GTIN}/21/{BATCH}`) on every physical batch resolves to a public passport page showing only verified claims, plus dedicated read-only portals for auditors and B2B buyers, and a full ESG/carbon/compliance analytics suite for the manufacturer's own sustainability reporting.
- **Regulatory-adjacent analytics**: an automatically computed Sustainability Readiness Index, PPWR 2030/2040 recycled-content target tracking, supplier performance ranking, and illustrative EU plastic-tax exposure — designed to make ESPR/PPWR compliance a byproduct of normal platform use, not a separate reporting exercise.

## 1.3 The value proposition

**For polymer manufacturers and recyclers:** turn an unavoidable compliance burden into a competitive credential. A verified, cryptographically sealed DPP is the difference between "we say our resin is 40% PCR" and "here is a QR code any auditor can scan to independently confirm it" — the latter is what OEM buyers, retailers under PPWR obligations, and market surveillance authorities will increasingly require as a condition of doing business.

**For B2B buyers in the chemical and plastics supply chain:** a single point of truth for the sustainability data they must themselves report under their own CSRD/ESPR obligations, without re-keying supplier claims into their own systems — verified data flows through with the batch.

**For NRW as a region:** a homegrown, EU-compliant DPP infrastructure layer for one of Germany's largest chemical and plastics industrial clusters, built and operated in NRW, reducing the region's dependence on non-EU software vendors for a compliance function that will become mandatory across the entire European polymer value chain within this decade.

## 1.4 Why now, why NRW

NRW is home to one of Europe's densest concentrations of chemical, plastics-processing, and recycling capacity (the Rhineland chemical triangle, the Ruhr area's industrial recycling infrastructure, and a strong Mittelstand compounding sector), sitting directly alongside a world-class materials-science research base at RWTH Aachen and the Fraunhofer institutes in the region. ESPR's delegated acts for priority product groups (which are expected to include plastics/packaging among the earlier waves) and PPWR's 2030 recycled-content thresholds create a hard deadline that is measured in a small number of years, not decades — the market window for becoming NRW's default DPP infrastructure provider is open now and will not stay open indefinitely once larger, better-capitalized vendors turn their attention to this exact regulatory moment.
