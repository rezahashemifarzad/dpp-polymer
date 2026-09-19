# Polymer DPP — NRW Grant Documentation Package

> **Key takeaway:** Five source documents covering the full business case for NRW.BANK/EFRE.NRW-type funding, plus a unified, printable executive report (`Polymer-DPP-Grant-Report.html`) that compiles all five into one polished, screen- and tablet-friendly document.

This folder contains the business plan, business model, and grant-alignment documentation for the Polymer Digital Product Passport (DPP) platform, prepared for funding applications and investor/grant conversations in North Rhine-Westphalia (NRW), Germany.

## Start here

**`Polymer-DPP-Grant-Report.html`** — open this file in any browser for the readable version: sticky navigation, a visual Business Model Canvas, a roadmap timeline, a financial-projections chart, and a "Print / Save as PDF" button for a clean printable export. It is generated from the five Markdown files below, so if you edit one of those, regenerate the report (ask Claude) to keep it in sync.

## Contents

| File | Purpose |
|---|---|
| [`01-executive-summary.md`](./01-executive-summary.md) | Executive summary and value proposition — the one-pager version of the whole pitch. |
| [`02-business-model-canvas.md`](./02-business-model-canvas.md) | Full Business Model Canvas plus a narrative expansion of revenue streams, cost structure, and target market. |
| [`03-nrw-grant-alignment.md`](./03-nrw-grant-alignment.md) | Mapping of the project to NRW/EU strategic priorities and to specific NRW funding instruments (NRW.BANK, EFRE.NRW/JTF, Ressource.NRW, RWTH Aachen ecosystem). |
| [`04-technical-architecture-summary.md`](./04-technical-architecture-summary.md) | Plain-language technical architecture summary for grant reviewers, grounded in the actual live codebase (Prisma/Neon, Next.js, immutable audit ledger, RBAC portals, GS1 QR). |
| [`05-roadmap-financial-projections.md`](./05-roadmap-financial-projections.md) | Commercialization roadmap, milestones, and illustrative financial projections. |
| [`Polymer-DPP-Grant-Report.html`](./Polymer-DPP-Grant-Report.html) | The five documents above, unified into one styled, navigable, printable report. |

## How to use this package

- Open **`Polymer-DPP-Grant-Report.html`** to read or print the whole package as one document.
- Each Markdown file is also standalone and can be pasted directly into an NRW.BANK / EFRE.NRW / regional cluster grant application form (most accept Markdown-derived plain text or PDF export).
- Converted to PDF or DOCX for a formal submission (the `pdf` and `docx` skills in this workspace can do this on request).
- Used as speaker notes / source material for an investor pitch deck (see `@Product-UI-Pitch` scope in `AGENTS.md`) — a pitch deck built from this same package already lives alongside it in this folder.

## Important caveats before submission

1. **Verify current program parameters before filing.** Funding ceilings, co-financing rates, deadlines, and eligibility rules for NRW.BANK and EFRE.NRW programs change between calls. Section 3 names the programs that fit this project's profile as of August 2026 and cites primary sources — always re-check the live NRW.BANK / EFRE.NRW / land.nrw pages immediately before submitting, since exact figures were not locked into this draft.
2. **Financial projections are illustrative, not audited.** Section 5's figures are placeholders sized to a plausible NRW polymer-compliance SaaS trajectory; they must be replaced with the founding team's own bottom-up model (headcount costs, actual pilot pricing, real customer pipeline) before being submitted as binding numbers in a grant application.
3. **No claims are made about certifications the platform does not yet hold.** The platform supports ISCC PLUS, ISO 14021, and EN 15343 *data capture and verification workflow* — it is not itself a certification body. Grant text should never imply the SaaS product is accredited to issue these certifications.
4. **Legal entity and grant-eligibility details are placeholders.** Company legal form, registered NRW address, headcount, and SME (KMU) status are the applicant's own facts and must be filled in — most NRW.BANK/EFRE.NRW programs are restricted to companies with a registered establishment (Betriebsstätte) in NRW and to defined SME size classes (see Section 3).

Owner: DPP-Polymer project — drafted by the multi-agent documentation workflow (Domain-Expert, Dev-Architect, Product-UI-Pitch, Compliance-Legal perspectives) on 2026-08-26.
