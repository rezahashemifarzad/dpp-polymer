/**
 * scripts/seed-sample-passports.ts
 * -----------------------------------------------------------------------
 * CLI seed script: creates a handful of realistic, fully-worked
 * PolymerPassport records for pilot demonstrations and investor/grant
 * pitches — four manufacturers across four regions (a PCR/rPET recycler
 * in Ningbo, China; a PIR/engineering-grade compounder in Surat, India;
 * and two NRW, Germany producers matching the platform's own home-market
 * pitch — Rheinland Kunststoff Compounding GmbH, bio-based PLA/PHA, and
 * Niederrhein Polymer Werke GmbH, an ultra-high-recycled-content/bio-based
 * "flagship" producer added for executive pitch material), two batches
 * each, spanning a range of recycled/bio-based content, carbon footprint,
 * and REACH/PPWR compliance profiles.
 *
 * Deliberately goes through the SAME creation + hash-chain + GS1-link +
 * audit-log machinery every real passport goes through
 * (lib/services/create-passport.ts, lib/audit.ts, lib/qr.ts, lib/gtin.ts)
 * rather than a raw prisma.polymerPassport.create() with made-up hash
 * values — so these sample records are indistinguishable, from the
 * audit trail's point of view, from ones a real manufacturer submitted,
 * and pass the same integrity checks (verifyAuditLogChainIntegrity in
 * lib/services/audit-log-service.ts) as everything else in the ledger.
 *
 * Every CLI script in this repo (prisma/seed.ts, scripts/create-auditor.ts,
 * scripts/allocate-passport-to-client.ts, ...) already avoids importing
 * lib/services/*.ts or lib/audit.ts/lib/types.ts directly: those modules
 * pull in "@/..." tsconfig path aliases internally (e.g.
 * lib/types.ts -> "@/lib/gtin", lib/audit.ts -> "@/lib/types",
 * lib/services/create-passport.ts -> "@/lib/prisma" + "@/lib/types"),
 * which tsx does not reliably resolve when a script runs standalone
 * outside the Next.js module graph — see create-auditor.ts's own note on
 * this exact trade-off. This script follows the same established
 * convention: the small amount of pure logic it needs (the canonical
 * hashRecord/stableStringify hasher, the GS1 Digital Link URL builder,
 * the GTIN-14 check-digit generator, and the AuditLog hash-chain writer)
 * is duplicated here, byte-for-byte equivalent to lib/types.ts,
 * lib/qr.ts, lib/gtin.ts, and lib/audit.ts respectively. If any of those
 * four ever change, mirror the change here too.
 *
 * Safe to run repeatedly: manufacturers are upserted by vatNumber (same
 * convention as prisma/seed.ts), Clients are upserted by contactEmail, and
 * any batchId that already exists is skipped rather than re-created or
 * overwritten. Client-passport allocations are upserted by the schema's
 * own @@unique([clientId, passportId]), same as
 * scripts/allocate-passport-to-client.ts.
 *
 * Usage:
 *   npx tsx scripts/seed-sample-passports.ts
 *
 * What you get: 10 passports across 4 manufacturers. 8 are walked all the
 * way to ISSUED (fully signed, ready to show in the public QR scan page
 * and the B2B dashboard) — including both Niederrhein Polymer Werke
 * batches, deliberately the highest-rated pair in the whole set (96.5%
 * PCR / 98% bio-based, lowest carbon footprints, dual certification,
 * PPWR Grade A); 2 are left at PENDING_VERIFICATION, so the Auditor
 * Portal's review queue also has live items to demo.
 *
 * Two of the ISSUED passports (one from the China recycler, one from the
 * India compounder) are deliberately SVHC_PRESENT — a realistic legacy-
 * contamination scenario for a PCR/PIR stream (residual DEHP plasticizer
 * in recycled PVC; residual DecaBDE flame retardant in WEEE-derived ABS)
 * — with real REACH Article 33 SubstanceDeclaration rows attached, so the
 * REACH SVHC Compliance widget (components/dashboard/reach-ppwr/
 * svhc-compliance-banner.tsx) and the public scan page's SVHC notice both
 * have live, non-empty data to demo instead of an all-clear portfolio.
 *
 * Also seeds 2 German (NRW-market) Client (buyer) rows — Rhein-Pack
 * Verpackungslösungen GmbH and AutoMold Systeme GmbH — each allocated the
 * top-tier German passports that match their line of business via
 * ClientPassportAccess, for a ready-to-show B2B Client Portal view in
 * executive pitches. (Client has no literal "preferred/approved" status
 * field in the schema — see prisma/schema.prisma's Client model; these
 * are represented the same way a real preferred/approved buyer would be:
 * `active: true`, a signed-in portal password, and a framework-agreement
 * note on each allocation — rather than inventing an unrequested schema
 * field for it.)
 *
 * IMPORTANT — this script talks directly to whatever database DATABASE_URL
 * points at (see .env), which in this repo IS the real production Neon
 * database — there is no separate local/dev database to sandbox this
 * against. Running it from a local machine/terminal has none of Vercel's
 * build-time System Environment Variables (VERCEL_URL etc.) available, so
 * resolveBaseUrl() below would otherwise silently fall through to
 * http://localhost:3000 and bake that into these six passports' persisted
 * public links — exactly what happened the first time this script was run
 * this way. It now refuses to run unless a real base URL is supplied,
 * matching scripts/backfill-gs1-links.ts's own guard.
 *
 * Two equivalent ways to supply it — pick whichever is easiest on your
 * shell. The --base-url flag is the recommended one: it is plain CLI-
 * argument syntax, so it runs identically in bash/zsh, Windows cmd.exe,
 * and PowerShell with no quoting differences to remember:
 *
 *   npx tsx scripts/seed-sample-passports.ts --base-url https://your-real-domain.example
 *
 * The NEXT_PUBLIC_BASE_URL env var also still works, but its inline
 * "VAR=value command" form is POSIX/bash-only and does NOT work in Windows
 * cmd.exe or PowerShell. On Windows, set it with your shell's own syntax
 * first:
 *
 *   # Windows cmd.exe
 *   set NEXT_PUBLIC_BASE_URL=https://your-real-domain.example && npx tsx scripts/seed-sample-passports.ts
 *
 *   # Windows PowerShell
 *   $env:NEXT_PUBLIC_BASE_URL="https://your-real-domain.example"; npx tsx scripts/seed-sample-passports.ts
 *
 *   # macOS/Linux bash/zsh
 *   NEXT_PUBLIC_BASE_URL=https://your-real-domain.example npx tsx scripts/seed-sample-passports.ts
 *
 * (--allow-localhost bypasses this, for a genuine local/throwaway database.)
 */

import "dotenv/config";
import { createHash, randomBytes } from "crypto";
import { PrismaClient, Prisma, AuditAction, PolymerType, RecycledContentSource, CertificationScheme, SvhcStatus, PpwrRecyclabilityGrade } from "@prisma/client";
// lib/password.ts has zero internal "@/" imports (only Node's crypto), so
// it's safe to pull in via a relative path here — same exception
// scripts/create-auditor.ts's own file banner already carves out.
import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();

// ----------------------------------------------------------------------------
// Duplicated from lib/gtin.ts (zero internal deps, so this is a byte-for-byte
// copy, not a reimplementation) — generates a valid GS1 GTIN-14.
// ----------------------------------------------------------------------------
function gtinCheckDigit(first13Digits: string): number {
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const digit = Number(first13Digits[i]);
    const weight = (12 - i) % 2 === 0 ? 3 : 1;
    sum += digit * weight;
  }
  return (10 - (sum % 10)) % 10;
}
function buildGtin(first13: string): string {
  return `${first13}${gtinCheckDigit(first13)}`;
}
/** 3-digit GS1 country prefix + a 10-digit sequence number, zero-padded. */
function gs1Prefix(countryPrefix3: string, seq: number): string {
  return `${countryPrefix3}${seq.toString().padStart(10, "0")}`;
}

// ----------------------------------------------------------------------------
// Duplicated from lib/types.ts's stableStringify/hashRecord — the canonical
// SHA-256 hash every recordHash and AuditLog.entryHash in this app is built
// from. Must stay byte-for-byte identical or these rows would fail the real
// integrity verifier.
// ----------------------------------------------------------------------------
function stableStringify(value: unknown): string {
  if (value instanceof Prisma.Decimal) return JSON.stringify(value.toFixed());
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(",");
  return `{${body}}`;
}
function hashRecord(data: Record<string, unknown>): string {
  return createHash("sha256").update(stableStringify(data), "utf8").digest("hex");
}

// ----------------------------------------------------------------------------
// Duplicated from lib/qr.ts's buildGs1VerificationUrl/deriveVerificationToken.
// This script runs outside the Next.js build (no next.config.ts env
// injection applies here), so it applies the same VERCEL_* fallback chain
// next.config.ts now uses for the live app — see that file's own comment
// for the full rationale. Only matters if this script is ever run in a
// Vercel build context; for a normal local `npx tsx` run with no VERCEL_*
// vars set, set NEXT_PUBLIC_BASE_URL yourself first if you want these
// sample passports' links to point somewhere other than localhost.
// ----------------------------------------------------------------------------
function deriveVerificationToken(recordHash: string): string {
  return recordHash.slice(0, 16);
}
/**
 * Reads a `--base-url <value>` (or `--base-url=<value>`) CLI argument, if
 * present. Added as a shell-agnostic alternative to NEXT_PUBLIC_BASE_URL:
 * plain argv, so it needs no env-var syntax at all and behaves identically
 * on bash/zsh, Windows cmd.exe, and PowerShell.
 */
function readBaseUrlFlag(): string | undefined {
  const argv = process.argv;
  const eqArg = argv.find((a) => a.startsWith("--base-url="));
  if (eqArg) return eqArg.slice("--base-url=".length);
  const idx = argv.indexOf("--base-url");
  if (idx !== -1 && argv[idx + 1]) return argv[idx + 1];
  return undefined;
}
function resolveBaseUrl(): string {
  const flagValue = readBaseUrlFlag();
  if (flagValue) return flagValue.replace(/\/+$/, "");
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
function buildGs1VerificationUrl(gtin: string, batchId: string, recordHash: string): { url: string; path: string } {
  const baseUrl = resolveBaseUrl();
  const path = `/01/${gtin}/21/${encodeURIComponent(batchId)}`;
  const url = `${baseUrl}${path}?v=${deriveVerificationToken(recordHash)}`;
  return { url, path };
}

// ----------------------------------------------------------------------------
// Duplicated from lib/audit.ts's writeAuditLog — same sequence/entryHash/
// previousEntryHash hash-chain computation, so seeded rows link into the
// SAME ledger chain as everything else instead of starting a fork of it.
// ----------------------------------------------------------------------------
type TxClient = Prisma.TransactionClient | PrismaClient;
function normalizeMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (metadata === undefined) return null;
  return JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>;
}
async function writeAuditLog(
  client: TxClient,
  params: {
    passportId: string;
    action: AuditAction;
    actor: string;
    previousHash: string | null;
    newHash: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const createdAt = new Date();
  const normalizedMetadata = normalizeMetadata(params.metadata);
  const previous = await client.auditLog.findFirst({
    orderBy: { sequence: "desc" },
    select: { sequence: true, entryHash: true },
  });
  const sequence = (previous?.sequence ?? 0) + 1;
  const previousEntryHash = previous?.entryHash ?? null;
  const entryHash = hashRecord({
    sequence,
    passportId: params.passportId,
    action: params.action,
    actor: params.actor,
    previousHash: params.previousHash,
    newHash: params.newHash,
    metadata: normalizedMetadata,
    createdAt,
    previousEntryHash,
  });
  return client.auditLog.create({
    data: {
      sequence,
      passportId: params.passportId,
      action: params.action,
      actor: params.actor,
      previousHash: params.previousHash,
      newHash: params.newHash,
      metadata: normalizedMetadata !== null ? (normalizedMetadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      entryHash,
      previousEntryHash,
      createdAt,
    },
  });
}

// ----------------------------------------------------------------------------
// Duplicated from lib/client-auth.ts's hashClientKey — same SHA-256-of-a-
// random-token convention as lib/auditor-auth.ts's hashAuditorKey (see
// scripts/create-auditor.ts's own copy). Used below to provision the two
// German demo Client rows with a real, working API key/portal password
// rather than a placeholder value.
// ----------------------------------------------------------------------------
function hashClientKey(rawKey: string): string {
  return createHash("sha256").update(rawKey, "utf8").digest("hex");
}
function generateRawKey(): string {
  return randomBytes(32).toString("hex");
}

// ----------------------------------------------------------------------------
// Sample data
// ----------------------------------------------------------------------------

interface ManufacturerSpec {
  key: string;
  legalName: string;
  vatNumber: string;
  gln: string;
  country: string;
}

interface CertSpec {
  scheme: CertificationScheme;
  certificateId: string;
  issuingBody: string;
  validFrom: Date;
  validUntil: Date;
  massBalanceAllocationPercent?: number;
}

// REACH Article 33 declared substance — mirrors
// lib/types.ts's SubstanceDeclarationInputSchema field-for-field (casNumber
// must match its "\d{2,7}-\d{2}-\d" CAS Registry Number shape).
interface SubstanceSpec {
  casNumber: string;
  substanceName: string;
  concentrationPercent: number; // % w/w — REACH's Article 33 threshold is 0.1%
  candidateListDate: Date; // which ECHA SVHC Candidate List revision this was checked against
  safeUseInstructions?: string;
}

interface PassportSpec {
  manufacturerKey: string;
  batchId: string;
  gtin: string;
  polymerType: PolymerType;
  grade: string;
  meltFlowIndex: number;
  mfiTestStandard: string;
  density: number;
  colorAdditives?: string;
  recycledContentSource?: RecycledContentSource;
  recycledContentPercent: number;
  recycledContentCertScheme?: CertificationScheme;
  bioBasedPercent: number;
  bioBasedTestStandard?: string;
  carbonFootprintKgCO2ePerKg: number;
  lcaThirdPartyVerified: boolean;
  lcaVerifierName?: string;
  productionDate: Date;
  certifications: CertSpec[];
  svhcStatus: SvhcStatus;
  // Required (non-empty) exactly when svhcStatus is "SVHC_PRESENT" — same
  // rule lib/types.ts's SvhcDeclarationInputSchema enforces at the API
  // layer; createOnePassport() below only creates SubstanceDeclaration
  // rows when this is present.
  svhcSubstances?: SubstanceSpec[];
  ppwr?: { grade: PpwrRecyclabilityGrade; pfasCompliant: boolean; pfasConcentrationPpb: number };
  issueToPublished: boolean; // walk PENDING_VERIFICATION -> ISSUED after creation
}

const MANUFACTURERS: ManufacturerSpec[] = [
  {
    key: "cn",
    legalName: "Ningbo Green Polymer Recycling Co., Ltd.",
    vatNumber: "CN-VAT-330211MA2E7K9X12",
    gln: gs1Prefix("690", 1),
    country: "CN",
  },
  {
    key: "in",
    legalName: "Surat Poly Industries Pvt. Ltd.",
    vatNumber: "IN-GSTIN-24AASCS1234K1Z5",
    gln: gs1Prefix("890", 1),
    country: "IN",
  },
  {
    key: "de",
    legalName: "Rheinland Kunststoff Compounding GmbH",
    vatNumber: "DE812345678",
    gln: gs1Prefix("400", 1),
    country: "DE",
  },
  {
    key: "de2",
    legalName: "Niederrhein Polymer Werke GmbH",
    vatNumber: "DE900123456",
    gln: gs1Prefix("400", 2),
    country: "DE",
  },
];

const PASSPORTS: PassportSpec[] = [
  // --- China — Ningbo Green Polymer Recycling: PCR recycler ---------------
  {
    manufacturerKey: "cn",
    batchId: "CN-NBGP-2026-0091",
    gtin: buildGtin(gs1Prefix("690", 100001)),
    polymerType: "HDPE",
    grade: "Recycled HDPE Bottle Grade RH-20",
    meltFlowIndex: 0.35,
    mfiTestStandard: "ISO 1133 (190°C/2.16kg)",
    density: 0.955,
    colorAdditives: "Natural (undyed)",
    recycledContentSource: "POST_CONSUMER",
    recycledContentPercent: 92.5,
    recycledContentCertScheme: "ISCC_PLUS",
    bioBasedPercent: 0,
    carbonFootprintKgCO2ePerKg: 1.15,
    lcaThirdPartyVerified: true,
    lcaVerifierName: "SGS China",
    productionDate: new Date("2026-07-14"),
    certifications: [
      {
        scheme: "ISCC_PLUS",
        certificateId: "ISCC-PLUS-CN-2026-04471",
        issuingBody: "ISCC System GmbH",
        validFrom: new Date("2025-09-01"),
        validUntil: new Date("2027-08-31"),
        massBalanceAllocationPercent: 92.5,
      },
    ],
    svhcStatus: "NONE_DECLARED",
    ppwr: { grade: "GRADE_A", pfasCompliant: true, pfasConcentrationPpb: 2.1 },
    issueToPublished: true,
  },
  {
    manufacturerKey: "cn",
    batchId: "CN-NBGP-2026-0092",
    gtin: buildGtin(gs1Prefix("690", 100002)),
    polymerType: "PET",
    grade: "Food-Contact rPET Flake FG-90",
    meltFlowIndex: 0.85,
    mfiTestStandard: "ISO 1133 (280°C/2.16kg)",
    density: 1.38,
    colorAdditives: "Clear, trace blue tint",
    recycledContentSource: "POST_CONSUMER",
    recycledContentPercent: 78,
    recycledContentCertScheme: "GRS",
    bioBasedPercent: 0,
    carbonFootprintKgCO2ePerKg: 1.42,
    lcaThirdPartyVerified: false,
    productionDate: new Date("2026-08-02"),
    certifications: [
      {
        scheme: "GRS",
        certificateId: "GRS-CN-2026-11820",
        issuingBody: "Control Union Certifications",
        validFrom: new Date("2026-01-15"),
        validUntil: new Date("2027-01-14"),
        massBalanceAllocationPercent: 78,
      },
    ],
    svhcStatus: "NONE_DECLARED",
    ppwr: { grade: "GRADE_B", pfasCompliant: true, pfasConcentrationPpb: 3.4 },
    issueToPublished: false,
  },

  // SVHC Sample Passports — a realistic legacy-contamination scenario for
  // a PCR stream: recycled PVC cable/hose compound sourced from mixed
  // legacy stock, carrying residual DEHP plasticizer above REACH's 0.1%
  // w/w Article 33 threshold. Still walked to ISSUED — a declared SVHC is
  // a transparent, compliant disclosure (that's the whole point of
  // Article 33), not a reason to withhold the passport. Demonstrates the
  // full regulatory-compliance-handling path: REACH SVHC Compliance
  // widget, public scan page SVHC notice, and Auditor Portal all see a
  // real SVHC_PRESENT record instead of an all-clear-only portfolio.
  {
    manufacturerKey: "cn",
    batchId: "CN-NBGP-2026-0093",
    gtin: buildGtin(gs1Prefix("690", 100003)),
    polymerType: "PVC",
    grade: "Recycled PVC Cable Compound RC-30 (Legacy Mixed Stock)",
    meltFlowIndex: 2.1,
    mfiTestStandard: "ISO 1133 (190°C/21.6kg)",
    density: 1.32,
    colorAdditives: "Black masterbatch 2.5%",
    recycledContentSource: "POST_CONSUMER",
    recycledContentPercent: 55,
    recycledContentCertScheme: "EN_15343",
    bioBasedPercent: 0,
    carbonFootprintKgCO2ePerKg: 1.51,
    lcaThirdPartyVerified: false,
    productionDate: new Date("2026-08-09"),
    certifications: [
      {
        scheme: "EN_15343",
        certificateId: "EN15343-CN-2026-2207",
        issuingBody: "SGS China",
        validFrom: new Date("2026-01-01"),
        validUntil: new Date("2027-12-31"),
        massBalanceAllocationPercent: 55,
      },
    ],
    svhcStatus: "SVHC_PRESENT",
    svhcSubstances: [
      {
        casNumber: "117-81-7",
        substanceName: "Bis(2-ethylhexyl) phthalate (DEHP)",
        concentrationPercent: 0.18,
        candidateListDate: new Date("2024-06-25"),
        safeUseInstructions:
          "Not for use in toys, childcare articles, or food-contact applications. Downstream users must observe REACH Article 33(1) communication obligations when this material is supplied further down the value chain.",
      },
    ],
    ppwr: { grade: "GRADE_C", pfasCompliant: true, pfasConcentrationPpb: 1.8 },
    issueToPublished: true,
  },

  // --- India — Surat Poly Industries: PIR compounder ----------------------
  {
    manufacturerKey: "in",
    batchId: "IN-SPIL-2026-0041",
    gtin: buildGtin(gs1Prefix("890", 200001)),
    polymerType: "PP",
    grade: "PIR Compound Automotive Grade PP-IM35",
    meltFlowIndex: 35,
    mfiTestStandard: "ISO 1133 (230°C/2.16kg)",
    density: 0.905,
    colorAdditives: "Carbon black masterbatch 2%",
    recycledContentSource: "POST_INDUSTRIAL",
    recycledContentPercent: 40,
    recycledContentCertScheme: "REDCERT2",
    bioBasedPercent: 0,
    carbonFootprintKgCO2ePerKg: 1.68,
    lcaThirdPartyVerified: false,
    productionDate: new Date("2026-06-28"),
    certifications: [
      {
        scheme: "REDCERT2",
        certificateId: "REDCERT2-IN-2026-3390",
        issuingBody: "REDcert GmbH",
        validFrom: new Date("2025-11-01"),
        validUntil: new Date("2026-10-31"),
        massBalanceAllocationPercent: 40,
      },
    ],
    svhcStatus: "NONE_DECLARED",
    ppwr: { grade: "GRADE_B", pfasCompliant: true, pfasConcentrationPpb: 4.5 },
    issueToPublished: true,
  },
  {
    manufacturerKey: "in",
    batchId: "IN-SPIL-2026-0042",
    gtin: buildGtin(gs1Prefix("890", 200002)),
    polymerType: "PA",
    grade: "Glass-Filled PA6 GF30 Engineering Grade",
    meltFlowIndex: 12,
    mfiTestStandard: "ISO 1133 (275°C/5kg)",
    density: 1.36,
    recycledContentSource: "POST_INDUSTRIAL",
    recycledContentPercent: 25,
    recycledContentCertScheme: "ISO_14021",
    bioBasedPercent: 0,
    carbonFootprintKgCO2ePerKg: 3.05,
    lcaThirdPartyVerified: false,
    productionDate: new Date("2026-08-19"),
    certifications: [
      {
        scheme: "ISO_14021",
        certificateId: "SELF-DECL-IN-2026-0117",
        issuingBody: "Surat Poly Industries (self-declared)",
        validFrom: new Date("2026-01-01"),
        validUntil: new Date("2027-12-31"),
      },
    ],
    svhcStatus: "NONE_DECLARED",
    // No PPWR assessment on this one — a glass-filled engineering-grade
    // compound bound for automotive parts, not packaging, which is exactly
    // the "legitimately no PPWR assessment at all" case the field's own
    // schema comment describes.
    issueToPublished: false,
  },

  // SVHC Sample Passports (2 of 2) — WEEE/e-waste-derived recycled ABS,
  // the other classic PIR/PCR legacy-contamination scenario: residual
  // DecaBDE brominated flame retardant from pre-restriction electronics
  // housings, above the 0.1% w/w Article 33 threshold. See the China
  // batch above (CN-NBGP-2026-0093) for the full rationale.
  {
    manufacturerKey: "in",
    batchId: "IN-SPIL-2026-0043",
    gtin: buildGtin(gs1Prefix("890", 200003)),
    polymerType: "ABS",
    grade: "Recycled ABS Compound (WEEE-Derived) RABS-20",
    meltFlowIndex: 18,
    mfiTestStandard: "ISO 1133 (220°C/10kg)",
    density: 1.06,
    colorAdditives: "Dark grey, mixed legacy stock",
    recycledContentSource: "POST_CONSUMER",
    recycledContentPercent: 45,
    recycledContentCertScheme: "GRS",
    bioBasedPercent: 0,
    carbonFootprintKgCO2ePerKg: 1.89,
    lcaThirdPartyVerified: false,
    productionDate: new Date("2026-08-24"),
    certifications: [
      {
        scheme: "GRS",
        certificateId: "GRS-IN-2026-3412",
        issuingBody: "Control Union Certifications",
        validFrom: new Date("2026-02-01"),
        validUntil: new Date("2027-01-31"),
        massBalanceAllocationPercent: 45,
      },
    ],
    svhcStatus: "SVHC_PRESENT",
    svhcSubstances: [
      {
        casNumber: "1163-19-5",
        substanceName: "Decabromodiphenyl ether (DecaBDE)",
        concentrationPercent: 0.12,
        candidateListDate: new Date("2024-06-25"),
        safeUseInstructions:
          "Confirm compliance with Regulation (EU) 2019/1021 (POPs) before use in any new article; downstream users must observe REACH Article 33(1) communication obligations when this material is supplied further down the value chain.",
      },
    ],
    ppwr: { grade: "GRADE_D", pfasCompliant: true, pfasConcentrationPpb: 2.6 },
    issueToPublished: true,
  },

  // --- Germany (NRW) — Rheinland Kunststoff Compounding: bio-based -------
  {
    manufacturerKey: "de",
    batchId: "DE-RKC-2026-0301",
    gtin: buildGtin(gs1Prefix("400", 300001)),
    polymerType: "PLA",
    grade: "Bio-based PLA Injection Grade BIO-PLA-40",
    meltFlowIndex: 6.5,
    mfiTestStandard: "ISO 1133 (210°C/2.16kg)",
    density: 1.24,
    recycledContentPercent: 0,
    bioBasedPercent: 65,
    bioBasedTestStandard: "EN 16785-1 (radiocarbon method)",
    carbonFootprintKgCO2ePerKg: 0.95,
    lcaThirdPartyVerified: true,
    lcaVerifierName: "TÜV Rheinland",
    productionDate: new Date("2026-07-30"),
    certifications: [
      {
        scheme: "EN_16785",
        certificateId: "EN16785-DE-2026-0208",
        issuingBody: "TÜV Rheinland",
        validFrom: new Date("2026-02-01"),
        validUntil: new Date("2028-01-31"),
      },
      {
        scheme: "ISCC_PLUS",
        certificateId: "ISCC-PLUS-DE-2026-08841",
        issuingBody: "ISCC System GmbH",
        validFrom: new Date("2025-10-01"),
        validUntil: new Date("2027-09-30"),
      },
    ],
    svhcStatus: "NONE_DECLARED",
    ppwr: { grade: "GRADE_A", pfasCompliant: true, pfasConcentrationPpb: 0.8 },
    issueToPublished: true,
  },
  {
    manufacturerKey: "de",
    batchId: "DE-RKC-2026-0302",
    gtin: buildGtin(gs1Prefix("400", 300002)),
    polymerType: "PHA",
    grade: "PHA Compostable Grade BIO-PHA-25",
    meltFlowIndex: 4.2,
    mfiTestStandard: "ISO 1133 (175°C/2.16kg)",
    density: 1.18,
    recycledContentPercent: 0,
    bioBasedPercent: 100,
    bioBasedTestStandard: "EN 16785-1 (radiocarbon method)",
    carbonFootprintKgCO2ePerKg: 0.62,
    lcaThirdPartyVerified: true,
    lcaVerifierName: "TÜV Rheinland",
    productionDate: new Date("2026-08-11"),
    certifications: [
      {
        scheme: "EN_16785",
        certificateId: "EN16785-DE-2026-0311",
        issuingBody: "TÜV Rheinland",
        validFrom: new Date("2026-03-01"),
        validUntil: new Date("2028-02-29"),
      },
      {
        scheme: "ISO_14040_44",
        certificateId: "LCA-ISO14040-DE-2026-0092",
        issuingBody: "TÜV Rheinland",
        validFrom: new Date("2026-03-01"),
        validUntil: new Date("2028-02-29"),
      },
    ],
    svhcStatus: "NONE_DECLARED",
    ppwr: { grade: "GRADE_A", pfasCompliant: true, pfasConcentrationPpb: 0.5 },
    issueToPublished: true,
  },

  // --- Germany (NRW) — Niederrhein Polymer Werke: second major NRW
  // manufacturer, added for executive/investor pitch material. Both
  // batches are deliberately top-tier across every metric (very high
  // recycled/bio-based content, lowest-in-set carbon footprints, dual
  // third-party certification, PPWR Grade A, clean SVHC) and walked
  // straight to ISSUED — same "fully signed, demo-ready" treatment as
  // the other issueToPublished:true rows above, not a new pattern.
  {
    manufacturerKey: "de2",
    batchId: "DE-NPW-2026-0501",
    gtin: buildGtin(gs1Prefix("400", 400001)),
    polymerType: "PP",
    grade: "Ultra-Pure rPP Premium Packaging Grade RP-96",
    meltFlowIndex: 8.2,
    mfiTestStandard: "ISO 1133 (230°C/2.16kg)",
    density: 0.91,
    colorAdditives: "Natural (undyed)",
    recycledContentSource: "POST_CONSUMER",
    recycledContentPercent: 96.5,
    recycledContentCertScheme: "ISCC_PLUS",
    bioBasedPercent: 0,
    carbonFootprintKgCO2ePerKg: 0.71,
    lcaThirdPartyVerified: true,
    lcaVerifierName: "DEKRA Assurance Services",
    productionDate: new Date("2026-08-05"),
    certifications: [
      {
        scheme: "ISCC_PLUS",
        certificateId: "ISCC-PLUS-DE-2026-09215",
        issuingBody: "ISCC System GmbH",
        validFrom: new Date("2026-01-01"),
        validUntil: new Date("2028-12-31"),
        massBalanceAllocationPercent: 96.5,
      },
      {
        scheme: "EN_15343",
        certificateId: "EN15343-DE-2026-0087",
        issuingBody: "DEKRA Assurance Services",
        validFrom: new Date("2026-01-15"),
        validUntil: new Date("2028-01-14"),
      },
    ],
    svhcStatus: "NONE_DECLARED",
    ppwr: { grade: "GRADE_A", pfasCompliant: true, pfasConcentrationPpb: 0.6 },
    issueToPublished: true,
  },
  {
    manufacturerKey: "de2",
    batchId: "DE-NPW-2026-0502",
    gtin: buildGtin(gs1Prefix("400", 400002)),
    polymerType: "PLA",
    grade: "High-Purity Bio-PLA Rigid Packaging Grade BP-98",
    meltFlowIndex: 5.8,
    mfiTestStandard: "ISO 1133 (210°C/2.16kg)",
    density: 1.25,
    recycledContentPercent: 0,
    bioBasedPercent: 98,
    bioBasedTestStandard: "EN 16785-1 (radiocarbon method)",
    carbonFootprintKgCO2ePerKg: 0.38,
    lcaThirdPartyVerified: true,
    lcaVerifierName: "TÜV Rheinland",
    productionDate: new Date("2026-08-22"),
    certifications: [
      {
        scheme: "EN_16785",
        certificateId: "EN16785-DE-2026-0455",
        issuingBody: "TÜV Rheinland",
        validFrom: new Date("2026-02-01"),
        validUntil: new Date("2028-01-31"),
      },
      {
        scheme: "ISCC_PLUS",
        certificateId: "ISCC-PLUS-DE-2026-09340",
        issuingBody: "ISCC System GmbH",
        validFrom: new Date("2025-11-01"),
        validUntil: new Date("2027-10-31"),
      },
    ],
    svhcStatus: "NONE_DECLARED",
    ppwr: { grade: "GRADE_A", pfasCompliant: true, pfasConcentrationPpb: 0.3 },
    issueToPublished: true,
  },
];

// ----------------------------------------------------------------------------
// German (NRW-market) sample Clients (buyers) — added for executive pitch
// material alongside the German manufacturer/passport data above. Client
// has no literal "preferred/approved" status field in the schema (see
// prisma/schema.prisma's Client model — just companyName/contactEmail/
// country/active/passwordHash/apiKeyHash); that qualitative status is
// represented the same way a real preferred/approved buyer would look in
// this data model instead: active: true, a working portal password (so
// this can be logged into live during a pitch), and a framework-agreement
// note on each allocation below.
// ----------------------------------------------------------------------------

interface ClientSpec {
  key: string;
  companyName: string;
  contactEmail: string;
  country: string;
  /** Demo-only portal password — printed once at the end of this script's
   *  output, same "shown once" convention as scripts/create-auditor.ts. */
  demoPassword: string;
}

const CLIENTS: ClientSpec[] = [
  {
    key: "rhein-pack",
    companyName: "Rhein-Pack Verpackungslösungen GmbH",
    contactEmail: "einkauf@rhein-pack.example.de",
    country: "DE",
    demoPassword: "RheinPack-Demo-2026!",
  },
  {
    key: "automold",
    companyName: "AutoMold Systeme GmbH",
    contactEmail: "procurement@automold-systeme.example.de",
    country: "DE",
    demoPassword: "AutoMold-Demo-2026!",
  },
];

interface ClientAllocationSpec {
  clientKey: string;
  batchId: string;
  quantityKg: number;
  notes: string;
}

const CLIENT_ALLOCATIONS: ClientAllocationSpec[] = [
  // Rhein-Pack — a packaging converter, matched to Niederrhein Polymer
  // Werke's two premium/rigid PACKAGING-grade batches (the highest-rated
  // pair in the whole seed set).
  {
    clientKey: "rhein-pack",
    batchId: "DE-NPW-2026-0501",
    quantityKg: 12000,
    notes: "Preferred supplier — approved buyer framework agreement, Q3 2026. Premium packaging line conversion.",
  },
  {
    clientKey: "rhein-pack",
    batchId: "DE-NPW-2026-0502",
    quantityKg: 8000,
    notes: "Preferred supplier — approved buyer framework agreement, Q3 2026. Rigid packaging line conversion.",
  },
  // AutoMold — an injection molder, matched to Rheinland Kunststoff's
  // bio-based PLA INJECTION grade batch.
  {
    clientKey: "automold",
    batchId: "DE-RKC-2026-0301",
    quantityKg: 5000,
    notes: "Approved supplier — interior trim component qualification passed. Preferred buyer status, Q2 2026 review.",
  },
];

const SEED_ACTOR = "ADMIN:seed-sample-passports";

async function upsertManufacturers(): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const m of MANUFACTURERS) {
    const row = await prisma.manufacturer.upsert({
      where: { vatNumber: m.vatNumber },
      update: {},
      create: { legalName: m.legalName, vatNumber: m.vatNumber, gln: m.gln, country: m.country },
    });
    ids[m.key] = row.id;
    console.log(`Manufacturer ready: ${row.legalName} (${row.country}) — id ${row.id}`);
  }
  return ids;
}

// Mirrors upsertManufacturers() above, but checked via findUnique + create
// (rather than prisma.client.upsert) because — unlike a Manufacturer,
// which has nothing sensitive to generate — a Client needs a freshly
// generated apiKeyHash/passwordHash only the FIRST time it's created; an
// upsert's `update` branch would either have to regenerate them on every
// re-run (rotating a real buyer's credentials out from under them, same
// class of bug scripts/create-auditor.ts's own banner warns about) or
// silently skip them, which is harder to reason about than just checking
// existence directly.
async function upsertClients(): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const c of CLIENTS) {
    const existing = await prisma.client.findUnique({ where: { contactEmail: c.contactEmail } });
    if (existing) {
      ids[c.key] = existing.id;
      console.log(`Client ready: ${existing.companyName} (${existing.country}) — id ${existing.id} [already existed]`);
      continue;
    }

    const rawApiKey = generateRawKey();
    const apiKeyHash = hashClientKey(rawApiKey);
    const passwordHash = await hashPassword(c.demoPassword);

    const row = await prisma.client.create({
      data: {
        companyName: c.companyName,
        contactEmail: c.contactEmail,
        country: c.country,
        apiKeyHash,
        active: true,
        passwordHash,
      },
    });
    ids[c.key] = row.id;
    console.log(`Client created: ${row.companyName} (${row.country}) — id ${row.id}`);
    console.log(`  Portal sign-in (shown once — /login): ${c.contactEmail} / ${c.demoPassword}`);
    console.log(`  Buyer API key (x-dpp-client-key header, shown once): ${rawApiKey}`);
  }
  return ids;
}

async function allocateClientPurchases(clientIds: Record<string, string>): Promise<void> {
  for (const alloc of CLIENT_ALLOCATIONS) {
    const clientId = clientIds[alloc.clientKey];
    const passport = await prisma.polymerPassport.findUnique({
      where: { batchId: alloc.batchId },
      select: { id: true },
    });
    if (!clientId || !passport) {
      console.log(`  Skipping allocation "${alloc.clientKey}" -> "${alloc.batchId}": client or passport not found.`);
      continue;
    }

    const client = CLIENTS.find((c) => c.key === alloc.clientKey);
    const quantityKg = new Prisma.Decimal(alloc.quantityKg);

    // Same upsert-by-(clientId, passportId) shape as
    // scripts/allocate-passport-to-client.ts, so a re-run of this script
    // updates (never duplicates) the allocation — but the audit entry
    // goes through THIS file's own writeAuditLog() (duplicated from
    // lib/audit.ts, same as every other audit write in this script)
    // rather than that reference script's raw prisma.auditLog.create():
    // AuditLog.sequence/entryHash are both required @unique columns with
    // no DB default (see prisma/schema.prisma) — only writeAuditLog()
    // computes them (hash-chain sequence + SHA-256 entryHash), so a raw
    // create() with neither field set would fail Prisma's validation.
    const access = await prisma.$transaction(async (tx) => {
      const row = await tx.clientPassportAccess.upsert({
        where: { clientId_passportId: { clientId, passportId: passport.id } },
        update: { quantityKg, notes: alloc.notes },
        create: { clientId, passportId: passport.id, quantityKg, notes: alloc.notes },
      });
      await writeAuditLog(tx, {
        passportId: passport.id,
        action: "CLIENT_PURCHASE_RECORDED",
        actor: SEED_ACTOR,
        previousHash: null,
        newHash: null,
        metadata: { clientId, clientCompanyName: client?.companyName ?? null, quantityKg: alloc.quantityKg },
      });
      return row;
    });
    console.log(
      `  Allocated ${alloc.batchId} -> ${client?.companyName ?? clientId} (${alloc.quantityKg} kg) — access ${access.id}.`
    );
  }
}

async function createOnePassport(spec: PassportSpec, manufacturerId: string): Promise<void> {
  const existing = await prisma.polymerPassport.findUnique({
    where: { batchId: spec.batchId },
    select: { id: true },
  });
  if (existing) {
    console.log(`  ${spec.batchId}: already exists — skipping.`);
    return;
  }

  // Mirrors createPassport()'s computeTotalRecycledPercent: this field is
  // just the recycled-content figure carried forward as a Prisma.Decimal.
  const totalRecycledPercent = new Prisma.Decimal(spec.recycledContentPercent);

  const recordData = {
    polymerType: spec.polymerType,
    grade: spec.grade,
    meltFlowIndex: spec.meltFlowIndex,
    mfiTestStandard: spec.mfiTestStandard,
    density: spec.density,
    densityTestStandard: "ISO 1183",
    colorAdditives: spec.colorAdditives,
    gtin: spec.gtin,
    recycledContentSource: spec.recycledContentSource,
    recycledContentPercent: spec.recycledContentPercent,
    recycledContentCertScheme: spec.recycledContentCertScheme,
    bioBasedPercent: spec.bioBasedPercent,
    bioBasedTestStandard: spec.bioBasedTestStandard,
    carbonFootprintKgCO2ePerKg: spec.carbonFootprintKgCO2ePerKg,
    lcaMethodology: "PEF",
    lcaScope: "cradle-to-gate",
    lcaThirdPartyVerified: spec.lcaThirdPartyVerified,
    lcaVerifierName: spec.lcaVerifierName,
    batchId: spec.batchId,
    manufacturerId,
    productionDate: spec.productionDate,
  };

  const recordHash = hashRecord({ ...recordData, totalRecycledPercent });
  const { url: qrCodePayloadUrl, path: gs1ResolverUri } = buildGs1VerificationUrl(spec.gtin, spec.batchId, recordHash);

  const created = await prisma.$transaction(async (tx) => {
    const passport = await tx.polymerPassport.create({
      data: {
        ...recordData,
        totalRecycledPercent,
        recordHash,
        hashAlgorithm: "SHA-256",
        previousRecordHash: null,
        qrCodePayloadUrl,
        status: "PENDING_VERIFICATION",
        certifications: { create: spec.certifications.map((c) => ({ ...c })) },
        gs1Link: {
          create: {
            gtin: spec.gtin,
            batchId: spec.batchId,
            resolverUri: gs1ResolverUri,
            targetUrl: qrCodePayloadUrl,
            recordHash,
          },
        },
      },
    });

    await writeAuditLog(tx, {
      passportId: passport.id,
      action: "CREATED",
      actor: `manufacturer:${manufacturerId}`,
      previousHash: null,
      newHash: recordHash,
      metadata: { batchId: spec.batchId, resolverUri: gs1ResolverUri, source: "seed-sample-passports" },
    });

    return passport;
  });

  console.log(`  ${spec.batchId}: created (${spec.polymerType}, ${spec.recycledContentPercent}% recycled / ${spec.bioBasedPercent}% bio-based).`);

  // --- REACH SVHC declaration (mirrors lib/services/declare-svhc-status.ts) ---
  const svhcSubstances = spec.svhcSubstances ?? [];
  await prisma.$transaction(async (tx) => {
    await tx.polymerPassport.update({
      where: { id: created.id },
      data: {
        svhcStatus: spec.svhcStatus,
        svhcStatusDeclaredAt: new Date(),
        svhcStatusDeclaredBy: SEED_ACTOR,
        // Same shape as declareSvhcStatus's own update call: substance rows
        // are only ever created when the status is SVHC_PRESENT.
        substanceDeclarations:
          spec.svhcStatus === "SVHC_PRESENT"
            ? {
                create: svhcSubstances.map((s) => ({
                  casNumber: s.casNumber,
                  substanceName: s.substanceName,
                  concentrationPercent: s.concentrationPercent,
                  candidateListDate: s.candidateListDate,
                  safeUseInstructions: s.safeUseInstructions,
                  declaredBy: SEED_ACTOR,
                })),
              }
            : undefined,
      },
    });
    await writeAuditLog(tx, {
      passportId: created.id,
      action: "REACH_SVHC_DECLARED",
      actor: SEED_ACTOR,
      previousHash: null,
      newHash: null,
      metadata: { status: spec.svhcStatus, substanceCount: svhcSubstances.length },
    });
  });
  if (svhcSubstances.length > 0) {
    console.log(`  ${spec.batchId}: REACH Article 33 — ${svhcSubstances.length} SVHC substance(s) declared.`);
  }

  // --- PPWR declaration (mirrors lib/services/declare-ppwr-compliance.ts), optional ---
  if (spec.ppwr) {
    await prisma.$transaction(async (tx) => {
      await tx.polymerPassport.update({
        where: { id: created.id },
        data: {
          ppwrRecyclabilityGrade: spec.ppwr!.grade,
          ppwrPfasCompliant: spec.ppwr!.pfasCompliant,
          ppwrPfasConcentrationPpb: spec.ppwr!.pfasConcentrationPpb,
          ppwrAssessedAt: new Date(),
          ppwrAssessedBy: SEED_ACTOR,
        },
      });
      await writeAuditLog(tx, {
        passportId: created.id,
        action: "PPWR_COMPLIANCE_DECLARED",
        actor: SEED_ACTOR,
        previousHash: null,
        newHash: null,
        metadata: {
          recyclabilityGrade: spec.ppwr!.grade,
          pfasCompliant: spec.ppwr!.pfasCompliant,
          pfasConcentrationPpb: spec.ppwr!.pfasConcentrationPpb,
        },
      });
    });
  }

  // --- Walk PENDING_VERIFICATION -> ISSUED (mirrors
  // lib/services/transition-passport-status.ts's transitionPassportStatus) ---
  if (spec.issueToPublished) {
    await prisma.$transaction(async (tx) => {
      const current = await tx.polymerPassport.findUniqueOrThrow({ where: { id: created.id } });
      const newHash = hashRecord({
        batchId: current.batchId,
        gtin: current.gtin,
        status: "ISSUED",
        previousRecordHash: current.recordHash,
        transitionedAt: new Date(),
      });
      await tx.polymerPassport.update({
        where: { id: current.id },
        data: {
          status: "ISSUED",
          previousRecordHash: current.recordHash,
          recordHash: newHash,
          signedAt: new Date(),
          signedBy: SEED_ACTOR,
        },
      });
      await writeAuditLog(tx, {
        passportId: current.id,
        action: "VERIFIED",
        actor: SEED_ACTOR,
        previousHash: current.recordHash,
        newHash,
        metadata: { note: "Seed data walked straight to ISSUED for demo purposes." },
      });
    });
    console.log(`  ${spec.batchId}: transitioned PENDING_VERIFICATION -> ISSUED.`);
  }
}

function checkBaseUrlSafeToWrite(): void {
  const allowLocalhost = process.argv.includes("--allow-localhost");
  const resolved = resolveBaseUrl();
  if (resolved.includes("localhost") && !allowLocalhost) {
    console.error(
      "Refusing to run: the resolved public base URL is " +
        `"${resolved}" (no --base-url flag or NEXT_PUBLIC_BASE_URL was ` +
        "found, and no VERCEL_* build env vars are present in this shell — " +
        "expected when running locally). This script writes directly to " +
        "whatever DATABASE_URL points at, which is the real production " +
        "database in this repo — running it like this would bake localhost " +
        "into every generated passport's public QR/verification link, " +
        "exactly as happened before. Re-run with the --base-url flag " +
        "(works the same in any shell, including Windows cmd.exe/PowerShell):\n" +
        "  npx tsx scripts/seed-sample-passports.ts --base-url https://your-real-domain.example\n" +
        "or pass --allow-localhost if you really are pointed at a throwaway/local database."
    );
    process.exitCode = 1;
    throw new Error("Aborted: unsafe base URL for a production database write.");
  }
  if (resolved.includes("localhost") && allowLocalhost) {
    console.warn(`--allow-localhost set — proceeding with base URL "${resolved}" anyway.\n`);
  }
}

async function main() {
  checkBaseUrlSafeToWrite();

  console.log("Seeding sample polymer passports for pilot demonstrations...\n");
  const manufacturerIds = await upsertManufacturers();

  console.log("\nCreating passports:");
  for (const spec of PASSPORTS) {
    await createOnePassport(spec, manufacturerIds[spec.manufacturerKey]);
  }

  console.log("\nProvisioning German sample Clients (buyers):");
  const clientIds = await upsertClients();

  console.log("\nAllocating passports to Clients:");
  await allocateClientPurchases(clientIds);

  const finalRows = await prisma.polymerPassport.findMany({
    where: { batchId: { in: PASSPORTS.map((p) => p.batchId) } },
    select: { batchId: true, status: true, qrCodePayloadUrl: true },
    orderBy: { batchId: "asc" },
  });
  console.log("\nDone. Public verification pages:");
  for (const row of finalRows) {
    console.log(`  ${row.batchId} [${row.status}]: ${row.qrCodePayloadUrl}`);
  }
}

main()
  .catch((err) => {
    console.error("seed-sample-passports failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
