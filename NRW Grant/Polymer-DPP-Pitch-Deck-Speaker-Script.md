# Polymer.DPP — Pitch Deck Speaker Script

**Deck:** `Polymer-DPP-Pitch-Deck.pptx` (14 slides) · **Target run time:** 7:45 (under the 7–8 minute ceiling) · **Audience:** general-purpose — works unmodified for a grant jury or a private investor room.

## How to use this script

Each section below covers one slide: the verbatim talking points (written to be *said*, not read off the slide), a time budget, a transition line into the next slide, and the visual focal point to anchor the audience's eye on while you talk. Durations are deliberately front-loaded on the slides that carry the thesis (Problem, Solution) and compressed on the slides that are mostly visual proof (How It Works, Tech Credibility) — rehearse against the cumulative-time column below so a slow slide 2 doesn't eat your slide 13 ask.

**Delivery posture throughout:** confident, declarative, technical-founder register — not a sales pitch. The deck's own copy already does this ("a working, deployed SaaS platform — not a concept"); the script leans into that same refrain rather than softening it. Where the deck is deliberately honest about what's *not* built yet (Slide 5, Slide 11), say those lines plainly and without apology — that candor is a credibility asset in front of a technical jury, not a weakness to bury.

| # | Slide | Duration | Cumulative |
|---|---|---|---|
| 1 | Title | 0:20 | 0:20 |
| 2 | The Problem | 0:45 | 1:05 |
| 3 | The Solution | 0:45 | 1:50 |
| 4 | How It Works | 0:35 | 2:25 |
| 5 | Technical Credibility | 0:35 | 3:00 |
| 6 | Why Now, Why NRW | 0:35 | 3:35 |
| 7 | Market Opportunity | 0:30 | 4:05 |
| 8 | Business Model | 0:40 | 4:45 |
| 9 | Roadmap | 0:35 | 5:20 |
| 10 | Illustrative Projections | 0:30 | 5:50 |
| 11 | Regional Ecosystem | 0:25 | 6:15 |
| 12 | Why This Wins | 0:30 | 6:45 |
| 13 | Next Steps / The Ask | 0:40 | 7:25 |
| 14 | Closing | 0:20 | 7:45 |

---

## Slide 1 — Title

**Duration: 0:20**

> Good [morning / afternoon] — I'm Reza, founder of Polymer.DPP. In one sentence: we're the Digital Product Passport infrastructure for Europe's polymer industry — the system that turns an incoming EU compliance mandate into a verifiable trust asset, instead of a spreadsheet nobody trusts.
>
> And I want to say this up front, because it sets up everything that follows: this is not a concept or a mockup. It's a live product, today, at dpp-polymer.vercel.app.

**Visual focal point:** the live-product line and the "EU ESPR 2026" badge — let both sit for a beat before advancing. This slide's job is to plant *urgency* (the regulation) and *credibility* (it's live) in the same breath.

**Transition:** a short pause, then — "Let me show you the problem this solves." → advance.

---

## Slide 2 — The Problem

**Duration: 0:45**

> Here's the shift happening right now: sustainability claims are becoming a legal requirement — not a marketing choice. Three EU rules — the Ecodesign for Sustainable Products Regulation, the Packaging and Packaging Waste Regulation, and the Green Claims Directive — turn "trust us, our resin is 40% recycled" into a compliance obligation with real legal exposure attached.
>
> That creates four specific operational problems for every polymer manufacturer in Europe. One: mass-balance recycled content has to be tracked batch by batch, not estimated at the product-line level. Two: certifications expire on a schedule, and somebody has to catch that before they lapse. Three: a verified carbon number has to be provably distinct from a marketing estimate — not blended into one. And four: every one of those claims has to be QR-scannable, GS1-Digital-Link compliant, by the time enforcement starts.
>
> And here's the part that matters for this room specifically: most mid-sized polymer processors — the Mittelstand backbone of NRW's chemical and plastics cluster — have neither the software capacity nor the regulatory staff to build this themselves.

**Visual focal point:** walk the four sub-points in the order they're printed (batch-by-batch → expiry → verified-vs-marketing → QR-scannable) — don't skip around, the slide is sequenced to build the case.

**Transition:** "So — what did we build to solve that?" → advance.

---

## Slide 3 — The Solution

**Duration: 0:45**

> This is Polymer.DPP — a working, deployed SaaS platform. Not a concept, not a prototype. Deployed, today.
>
> Five things it actually does. It captures material data at industrial-grade precision — melt flow index, density, tensile strength, PCR content, carbon footprint — stored as exact decimals, zero floating-point drift, because that number might end up quoted in a regulatory filing.
>
> It runs a multi-party trust workflow: manufacturers submit, independently credentialed auditors verify or reject — before anything is ever shown as fact.
>
> Every batch record is SHA-256 sealed and written into an append-only, hash-chained audit ledger. That's cryptographic immutability, not a promise of it.
>
> Every batch carries a GS1 Digital Link QR code that resolves to a public passport — consumer- and auditor-facing, showing only verified claims.
>
> And on top of all of that, we compute regulatory-adjacent analytics automatically — a Sustainability Readiness Index, PPWR 2030/2040 target tracking, supplier performance ranking. Compliance becomes a byproduct of normal use, not a separate project.

**Visual focal point:** the five feature cards, top to bottom. If you have a live browser tab ready, this is the strongest moment in the deck to glance up and say "and I can show you this live after" — plant the seed, don't break stride to actually tab over.

**Transition:** "Let me show you how that actually flows, end to end." → advance.

---

## Slide 4 — How It Works

**Duration: 0:35**

> It's a single verified record moving through four stages. The manufacturer submits batch data — MFI, density, PCR percentage, footprint. An independent, individually credentialed auditor verifies the certifications and claims. The record is sealed — SHA-256, written into that append-only, hash-chained ledger. And then it's accessible — a GS1 QR scan for a consumer or auditor, or the Buyer API for an OEM — and only verified data is ever shown.
>
> One detail I want to underline: that filtering happens server-side. An unverified claim isn't just hidden in the interface — it's never even transmitted to a public request.

**Visual focal point:** track the four-stage arrow left to right with your hand or a pointer as you name each stage — Manufacturer, Auditor, Sealed, Public/Buyer. The motion should match the words exactly.

**Transition:** "That's the workflow. Now — why you can trust the plumbing underneath it." → advance.

---

## Slide 5 — Technical Credibility

**Duration: 0:35**

> Four numbers that matter if you're doing technical diligence right now. SHA-256 — every batch record is cryptographically sealed. Zero — zero floating-point rounding drift on any regulatory numeric field, because we use exact decimal types, not native floats, for anything that could end up quoted in a filing. Three — three independently session-authenticated roles: admin, auditor, buyer, each with its own access boundary. And GS1 — Digital-Link-compliant QR on every single issued passport, not a format we invented ourselves.
>
> And I'll say this because I'd rather you hear it from me than find it yourselves: our own technical documentation names exactly what's still planned — a first-class batch-weight field, and a formal third-party security review. We'd rather be precise about what's live versus what's next than oversell it.

**Visual focal point:** the four stat callouts — SHA-256, 0, 3, GS1 — give each about the same beat of silence before naming it. This slide reads like a scorecard; don't rush it.

**Transition:** "So the deadline this solves for isn't abstract — here's why it's urgent, and why NRW specifically." → advance.

---

## Slide 6 — Why Now, Why NRW

**Duration: 0:35**

> Two things are converging, and the timing is the pitch. On the "why now" side: ESPR's delegated acts are expected to bring plastics and packaging into an early compliance wave. PPWR's 2030 recycled-content thresholds are a hard, published deadline — not a someday target. And the Green Claims Directive directly targets unsubstantiated environmental claims with real legal exposure.
>
> On the "why NRW" side: this is one of Europe's densest chemical clusters — the Rhineland corridor and the Ruhr-area recycling base. It has a strong Mittelstand compounding sector facing this exact deadline today, not hypothetically. And RWTH Aachen and Fraunhofer sit right alongside that industrial base as a world-class materials-science research anchor.

**Visual focal point:** the two-column split — gesture left for "Why Now," right for "Why NRW." This is the slide that plants the flag: regional-first, deadline-driven thesis, not a vague global TAM claim.

**Transition:** "So who exactly is the customer inside that cluster?" → advance.

---

## Slide 7 — Market Opportunity

**Duration: 0:30**

> Three-sided market, anchored in NRW. Primary: polymer compounders and recyclers, 50 to 500 employees, across NRW and DACH, already producing PCR, PIR, or bio-based grades. Secondary: B2B buyers — OEMs and converters — who need verified supplier data for their own CSRD and ESPR reporting. Tertiary: independent auditors, who use the platform as their verification tool of record.
>
> The expansion path is built into the regulation itself: NRW, then the wider DACH chemical cluster, then EU-wide — because ESPR and PPWR aren't German law, they're EU law. Every polymer manufacturer across the Union faces the same deadline we do.

**Visual focal point:** the PRIMARY / SECONDARY / TERTIARY badges first, then land on the expansion-path arrow at the bottom as you say "NRW → DACH → EU-wide."

**Transition:** "Given that market, here's how we make money." → advance.

---

## Slide 8 — Business Model

**Duration: 0:40**

> Five recurring revenue lines, all aligned to usage — not one-off project fees. The core is a tiered manufacturer subscription, priced by batch volume and feature tier. Alongside that: per-seat licensing for the credentialed Auditor Portal — auditors are a distinct, professionally liable user class, priced separately. A versioned Buyer API for OEMs, feeding verified data into their own CSRD and ERP pipelines. Compliance export and certificate services — PDF certificates, QR label sheets, audit-ready export workbooks. And onboarding and data-migration services for larger accounts moving off spreadsheets.
>
> There's a sixth line we're flagging as optional, not assumed: white-label and multi-tenant licensing for industry associations or certification bodies. That's a post-MVP expansion option — we are not building Year 1 numbers around it.

**Visual focal point:** walk the five core cards top to bottom, then pause on the "future/optional" line at the bottom — say it a notch quieter than the rest. It signals financial discipline, not a hidden upside you're overselling.

**Transition:** "Here's the phased plan for getting there." → advance.

---

## Slide 9 — Roadmap

**Duration: 0:35**

> Four phases. Phase 0, Foundation, is complete — the core platform is live today: the passport data model, the cryptographic ledger, the GS1 QR engine, certification workflow, auditor and buyer portals, ESG analytics. That's not a plan — that's shipped.
>
> Phase 1, months 1 through 6: pilot validation — 3 to 5 pilot manufacturers, an initial auditor network, formalizing the RWTH Aachen advisory relationship, security hardening, and our first grant filing.
>
> Phase 2, months 7 through 18: regional scale-up — paid conversions, the Buyer API commercially live, the batch-weight field shipped, the auditor network formalized.
>
> Phase 3, months 19 through 36: DACH and EU expansion — a wider DACH sales motion, evaluating white-label, a follow-on research grant, and EU market entry as ESPR applies bloc-wide.

**Visual focal point:** the four phase columns — linger half a beat on the "Complete" badge on Phase 0. That badge is the credibility anchor for every phase after it.

**Transition:** "What does that trajectory look like in numbers? Big caveat first." → advance.

---

## Slide 10 — Illustrative Projections

**Duration: 0:30**

> I want to be direct about this slide before I say a single number: illustrative, not audited. These are placeholders sized to a plausible trajectory — not based on signed contracts or committed pricing.
>
> With that said, the shape of the model: Year 1, 5 to 8 manufacturer accounts and 3 to 5 auditor seats. Year 2, 20 to 30 accounts, 10 to 15 auditors. Year 3, 50 to 80 accounts, 25 to 35 auditors. The chart plots the midpoint of each range.
>
> We're showing you the structure of the model, not a forecast we're asking you to believe today — that gets replaced with a real bottom-up number the moment we have signed pilot pricing.

**Visual focal point:** say "illustrative, not audited" while gesturing at that badge specifically — *before* the chart or the numbers. Sequencing the caveat first, not as a footnote after, is what makes this land as rigor rather than a hedge.

**Transition:** "What derisks that trajectory is the ecosystem we're building in." → advance.

---

## Slide 11 — Regional Ecosystem

**Duration: 0:25**

> Three things about being built in NRW specifically. An advisory relationship with RWTH Aachen's Center for Circular Economy — and I want to be precise: that's a synergy we're formalizing, not an existing named partnership yet — would give independent, technical validation of our methodology. RWTH already runs active circular-economy research with major regional chemical players, which tells you this ecosystem carries real credibility with exactly the customer base we're targeting. And proximity to RWTH's materials-science graduate programs supports our own domain-expertise pipeline, and a plausible joint research application in year two and beyond.

**Visual focal point:** three cards, left to right. Keep the "not yet an existing named partnership" phrasing exactly as written — say it plainly. In front of a technical jury, that precision reads as credibility, not as a gap.

**Transition:** "Put that ecosystem and the technical depth together, and here's why we win against the alternative." → advance.

---

## Slide 12 — Why This Wins

**Duration: 0:30**

> The honest alternative isn't another DPP startup — it's a generic ERP or PLM vendor bolting on a compliance module. And here's why that doesn't hold up: they're not built around DPP-specific data models, they have no cryptographic tamper-evidence layer, no native GS1 Digital Link QR resolution, and no credentialed multi-party verification workflow.
>
> We built all four of those in from day one: a purpose-built schema for MFI, PCR/PIR, mass balance, and LCA; a SHA-256 sealed, hash-chained append-only ledger; native GS1 Digital Link QR on every passport; and an individually credentialed auditor verification workflow. This isn't a feature checklist — it's the difference between compliance bolted on and compliance built in.

**Visual focal point:** let the left column ("No / No / No") land fully before your gesture moves to the right column's "Yes" equivalents — the contrast is the argument, so don't read both columns simultaneously.

**Transition:** "So here's specifically what we're asking for." → advance.

---

## Slide 13 — Next Steps / The Ask

**Duration: 0:40**

> Four concrete asks. First: pilot manufacturer customers — 3 to 5 accounts spanning a compounder, a recycler, and a converter, to validate the data model against real production diversity. Second: regional grant co-financing — NRW.BANK.Invest Zukunft, EFRE.NRW, Ressource.NRW — to bridge pilot-phase costs ahead of paid revenue. Third: the RWTH Aachen advisory partnership — converting that ecosystem synergy into a named, citable relationship. And fourth: capital and partners for scale-up — funding the transition from a validated pilot to regional-scale paid infrastructure.
>
> If you're in a position to help with any one of those four, that's the conversation I want to have after this.

**Visual focal point:** the four ask cards — but this is the slide to look up and hold eye contact with the room, not the screen. It's the highest-stakes ask in the deck; deliver it to people, not to the slide.

**Transition:** "Let me close." → advance.

---

## Slide 14 — Closing

**Duration: 0:20**

> Let's build NRW's Digital Product Passport infrastructure together. The product is live — dpp-polymer.vercel.app — you can go look at it today, not next quarter. I'm Reza Hashemi Farzad, reza.h.farzad@gmail.com. Thank you.

**Visual focal point:** the live-demo URL and contact line. Hold this slide — don't advance past it. It's your Q&A backdrop, so leave it up.

**Transition:** none — open the floor for questions.

---

## Rehearsal notes

- **If you're running long:** the safest cuts are the second half of Slide 2 (the four-point list can compress to "batch tracking, expiring certs, verified-vs-marketing, and QR scannability — all of it") and the RWTH detail in Slide 11 (drop to one sentence). Never cut the caveat sentence on Slide 10 or the "planned, not yet built" line on Slide 5 — those are credibility assets, not filler.
- **If you're running short** (extra Q&A time is good, but if you need to fill): expand Slide 4 with a concrete example batch (e.g., "picture a 20-ton PCR-45 batch from a Ruhr-area recycler...") walked through all four stages by name.
- **Hardest slide to rush:** Slide 13. Resist the urge to speed up because it's near the end — it's the only slide with a direct ask, and pacing dictates whether it lands as a request or an afterthought.
