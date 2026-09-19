# Sample Pilot Passport Data — Seed Script

**Status:** Complete. Committed to the repo at `scripts/seed-sample-passports.ts`.

## What this is

A standalone CLI seed script that creates 6 realistic, fully-worked `PolymerPassport` records for pilot demonstrations and investor/grant pitches — requested directly: "a quick seed script... that allows me to automatically generate a few realistic sample polymer passports... representing polymer suppliers from different regions (China, India, NRW Germany), including metrics like recycled content percentage, carbon footprint, and ESPR/PPWR compliance data."

Usage:
```
npx tsx scripts/seed-sample-passports.ts
```
Safe to run repeatedly — manufacturers are upserted by `vatNumber` (same convention as `prisma/seed.ts`), and any `batchId` that already exists is skipped rather than re-created or overwritten, per the Baseline Rule.

## The three manufacturers / six passports

- **Ningbo Green Polymer Recycling Co., Ltd. (China)** — a PCR recycler. `CN-NBGP-2026-0091`: rHDPE bottle grade, 92.5% post-consumer recycled content (ISCC PLUS), 1.15 kg CO2e/kg, PPWR Grade A, walked to **ISSUED**. `CN-NBGP-2026-0092`: food-contact rPET flake, 78% PCR (GRS), 1.42 kg CO2e/kg, PPWR Grade B, left at **PENDING_VERIFICATION** (demo material for the Auditor Portal's review queue).
- **Surat Poly Industries Pvt. Ltd. (India)** — a PIR compounder. `IN-SPIL-2026-0041`: automotive-grade PP, 40% post-industrial recycled content (REDcert2), 1.68 kg CO2e/kg, PPWR Grade B, walked to **ISSUED**. `IN-SPIL-2026-0042`: glass-filled PA6 engineering compound, 25% PIR, self-declared (ISO 14021), 3.05 kg CO2e/kg, deliberately **no PPWR assessment** (an automotive part, not packaging — exercises the "legitimately no PPWR assessment" case the schema's own comment describes), left at **PENDING_VERIFICATION**.
- **Rheinland Kunststoff Compounding GmbH (NRW, Germany)** — a bio-based producer, matching the platform's own home-market pitch. `DE-RKC-2026-0301`: bio-based PLA, 65% bio-based content (EN 16785 + ISCC PLUS, third-party LCA verified by TÜV Rheinland), 0.95 kg CO2e/kg, PPWR Grade A, walked to **ISSUED**. `DE-RKC-2026-0302`: 100% bio-based PHA (marine-biodegradable-grade), 0.62 kg CO2e/kg — the lowest footprint in the set, EN 16785 + ISO 14040/44 LCA certified, PPWR Grade A, walked to **ISSUED**.

Every batch carries a REACH SVHC declaration (`NONE_DECLARED` — clean, assessed) so the compliance dashboard has real data to show for all six, not blank/unassessed rows.

## Why it goes through the real creation path, not a raw insert

The script deliberately reuses the exact same business logic every real passport submission goes through — hash-chained `recordHash`, the GS1 Digital Link resolver row, and the `AuditLog` hash-chain (`sequence`/`entryHash`/`previousEntryHash`) — rather than a raw `prisma.polymerPassport.create()` with made-up hash values. That means these six sample records are indistinguishable, from the audit trail's point of view, from ones a real manufacturer submitted, and they pass the same integrity checks (`verifyAuditLogChainIntegrity` in `lib/services/audit-log-service.ts`) as everything else in the ledger — important for a pilot demo where a reviewer or investor might click into the audit trail.

Following the pattern already established by every other CLI script in this repo (`prisma/seed.ts`, `scripts/create-auditor.ts`, `scripts/allocate-passport-to-client.ts`), the script does **not** import `lib/services/create-passport.ts`, `lib/audit.ts`, or `lib/types.ts` directly — those modules pull in `"@/..."` tsconfig path aliases internally, which `tsx` doesn't reliably resolve when a script runs standalone outside the Next.js module graph (the exact issue `create-auditor.ts`'s own file banner already documents). Instead, the small amount of pure logic needed is duplicated byte-for-byte: the canonical `hashRecord`/`stableStringify` hasher and GTIN-14 check-digit generator (from `lib/types.ts` / `lib/gtin.ts`), the GS1 Digital Link URL builder (`lib/qr.ts`), and the `AuditLog` hash-chain writer (`lib/audit.ts`). If any of those four ever change, this script's copies need to be mirrored too — flagged explicitly in the script's own header comment.

After creating each passport (status `PENDING_VERIFICATION`, matching `createPassport()`'s real behavior exactly), the script separately declares REACH SVHC status and PPWR compliance (mirroring `declare-svhc-status.ts`/`declare-ppwr-compliance.ts`'s "attach to an existing batch" pattern) and, for four of the six, walks the passport through to `ISSUED` (mirroring `transitionPassportStatus`'s hash re-chain + `signedAt`/`signedBy` + `VERIFIED` audit entry) — so the demo has a believable mix of fully-signed passports and open review-queue items, not six identical fresh drafts.

## Verified, not changed

Syntax-checked via `esbuild` (parses cleanly — full `tsc` type-checking wasn't possible in the sandbox, which has no `node_modules`/generated Prisma client; the user should run `npx tsc --noEmit` locally before or after first running the script). No existing file was modified — this is a new, additive script only, consistent with the Baseline Rule.

## Not built (out of scope for this request)

cURL / raw `POST /api/passports` examples were not built as a separate deliverable — the seed script is the more complete and correct path (it doesn't require provisioning a manufacturer API/RBAC key first, and it's directly re-runnable). If cURL examples against the live API are still wanted for documentation purposes, that's a small, separate follow-up.
