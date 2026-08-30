# Pitch Deck & Investor Materials

**Status:** Complete. Committed to the repo at `docs/pitch-deck/Polymer-DPP-Pitch-Deck.pptx`, delivered to the user as a downloadable file.

## What this is

A 14-slide, general-purpose pitch deck for Polymer DPP, built as a follow-on to the NRW grant package (`docs/grant-nrw/`). Requested explicitly by the user as the next step after the grant package and the GS1/admin-auth loose ends were closed out: "I'd like to work on preparing the Pitch Deck and investor materials mentioned in the NRW grant package follow-up."

## Scope decisions (confirmed with the user via clarifying question before drafting)

- **Primary audience:** one deck, general-purpose — works for both private investors and public grant reviewers, rather than two separate versions. Chosen so the narrative (product, market, technical credibility, roadmap) stays flexible enough to adapt later rather than forking into audience-specific decks now.
- **Financials & traction numbers:** kept as clearly-labeled illustrative placeholders, following the exact convention already established in `docs/grant-nrw/05-roadmap-financial-projections.md` — not fabricated "real-looking" numbers. Same range figures reused (Year 1: 5–8 manufacturer accounts / 3–5 auditor seats; Year 2: 20–30 / 10–15; Year 3: 50–80 / 25–35), with an explicit "ILLUSTRATIVE — NOT AUDITED" badge and a disclaimer that the numbers are not based on signed contracts or audited financials.

## Structure (14 slides)

1. Title — "Polymer.DPP: The Digital Product Passport Infrastructure for Europe's Polymer Industry"
2. The Problem
3. The Solution — a working, deployed SaaS platform, not a concept
4. How It Works (product walkthrough)
5. Technical Architecture credibility (cryptographic sealing, GS1 Digital Link, Prisma.Decimal precision)
6. Compliance Coverage (ESPR / PPWR / REACH-SVHC)
7. Market Opportunity (NRW beachhead → DACH → EU)
8. Business Model (five revenue lines, from `docs/grant-nrw/02-business-model-canvas.md` Section 2.2)
9. Roadmap (Phase 0 complete → Phase 3 DACH/EU expansion)
10. Illustrative Financial Projections (native pptxgenjs bar chart + exact-range side card + illustrative-data disclaimer)
11. Regional Ecosystem (RWTH Aachen Center for Circular Economy synergy — worded as an opportunity to formalize, not an existing named partnership, matching the grant package's own honesty caveat)
12. Why This Wins (competitive comparison vs. generic ERP/PLM vendors)
13. Next Steps / The Ask (pilot customers, RWTH advisory relationship, grant co-financing, capital & partners)
14. Closing (live demo link, contact placeholder for the founder to fill in)

## Design

Palette: teal (`14B8A6`) + navy (`0F172A`/`1E2761`), chosen to match the actual live product's own UI theme rather than a generic deck palette. Dark/light "sandwich" structure (dark title and closing slides, light content slides). Consistent icon-in-colored-circle motif (react-icons/Feather icons, rendered via `ReactDOMServer` + `sharp` to PNG) — no accent-line or color-bar/stripe motifs per current design guidance. Native pptxgenjs bar chart on the financials slide rather than an image.

## Build pipeline

`pptxgenjs`, following the pptx skill's guidance: `render_icons.js` renders 17 Feather icons to white PNGs; `build_deck.js` assembles all 14 slides. QA sequence run and passed: `validate.py` (schema/relationship/content-type/chart checks — all passed), `markitdown` + placeholder-text grep (no leftover template artifacts — the only bracketed placeholder is the intentional `[ add founder name & email ]` contact field on the closing slide, left for the founder to fill in), and full visual QA (LibreOffice → PDF → JPEG per slide) across all 14 slides at 150dpi — no text overflow, no overlaps, correct icon contrast, consistent spacing.

## Bug fixed during this build

First icon-rendering pass produced solid black icon silhouettes instead of white line icons, from two compounding bugs: (1) the SVG root `<svg>` tag from react-icons' output (carrying `stroke="currentColor" fill="none" stroke-width="2"`) was being stripped and rebuilt bare, discarding those attributes so child paths fell back to default solid-black fill; (2) the color value passed to react-icons was `"FFFFFF"` without a `#` prefix, which is invalid CSS and would have resolved to black regardless. Fixed by using react-icons' `renderToStaticMarkup` output completely unmodified and passing `"#FFFFFF"` (with `#`). Verified via raw SVG markup inspection, then re-ran the full build + QA pipeline.

## Not yet done (flagged for the user, not started without direction)

- The founder name/email contact field on the closing slide is a placeholder — needs to be filled in before this deck is sent to anyone.
- Financial figures are illustrative only, per the same caveat carried from the grant package — must be replaced with a real bottom-up model before use in any binding application or investor conversation.
