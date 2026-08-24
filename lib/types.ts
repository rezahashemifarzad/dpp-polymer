/**
 * lib/types.ts
 * -----------------------------------------------------------------------
 * Zod input validation for the polymer passport claim, plus the two pure
 * helper functions the API routes depend on:
 *
 *   - hashRecord(data)                    → canonical SHA-256 over the claim
 *   - computeTotalRecycledPercent(input)  → Prisma.Decimal
 *
 * All numeric metrics (mfi, density, recycled %, bio-based %, carbon
 * footprint) stay as Prisma.Decimal from this boundary onward — never a
 * loose JS float — per the project's numeric-precision rule.
 */

import { createHash } from "crypto";
import { z } from "zod";
import {
  Prisma,
  PolymerType,
  RecycledContentSource,
  CertificationScheme,
  ChainOfCustodyTier,
} from "@prisma/client";
import { isValidGtin14 } from "@/lib/gtin";

// Re-exported so existing `import { isValidGtin14 } from "@/lib/types"`
// call sites keep working. New code — especially client components —
// should import from "@/lib/gtin" directly: this module pulls in Node's
// `crypto` and `@prisma/client` at load time, neither of which belongs in
// a browser bundle.
export { isValidGtin14 } from "@/lib/gtin";

// ----------------------------------------------------------------------------
// GTIN (GS1 mod-10 check digit)
// ----------------------------------------------------------------------------

export const GtinSchema = z
  .string()
  .length(14, "GTIN must be exactly 14 digits")
  .regex(/^\d{14}$/, "GTIN must contain only digits")
  .refine(isValidGtin14, { message: "GTIN fails the GS1 mod-10 check digit validation" });

/**
 * GS1 Digital Link URLs are allowed to encode a GTIN with its leading
 * zero(s) stripped (a bare GTIN-13/UPC-12 padded up to the canonical
 * GTIN-14 form). app/01/[gtin]/21/[serialOrBatch]/page.tsx reads the raw
 * `gtin` route param straight off the URL and needs to compare it against
 * the 14-digit form stored on the passport row — this is the shared
 * left-pad-with-zeros helper that makes that comparison correct instead of
 * silently failing whenever a scanner or browser normalizes away leading
 * zeros. Non-digit input is returned unchanged (comparison will just fail,
 * which is correct — an invalid GTIN should never "match").
 */
export function padGtinTo14(raw: string): string {
  if (!/^\d+$/.test(raw)) return raw;
  return raw.padStart(14, "0");
}

// ----------------------------------------------------------------------------
// Certification
// ----------------------------------------------------------------------------

export const CertificationInputSchema = z
  .object({
    scheme: z.enum(CertificationScheme),
    certificateId: z.string().min(1, "certificateId is required"),
    issuingBody: z.string().min(1, "issuingBody is required"),
    validFrom: z.coerce.date(),
    validUntil: z.coerce.date(),
    documentUrl: z.string().url().optional(),

    // Compliance & Green Certifications Module additions (see
    // docs/COMPLIANCE_CERTIFICATIONS_MODULE_SPEC.md §2.2). Both optional —
    // adding them here doesn't change validation for existing callers
    // (the nested certifications[] on PolymerPassportInputSchema).
    //
    // documentHash: SHA-256 hex digest of the certificate document,
    // computed by whoever uploads it (client-side or wherever the file
    // actually lives) and submitted alongside documentUrl. Deliberately
    // NOT computed server-side by fetching documentUrl — having this API
    // fetch an arbitrary caller-supplied URL would be an SSRF vector.
    documentHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/i, "documentHash must be a 64-character hex SHA-256 digest")
      .optional(),
    // Only meaningful for mass-balance schemes (ISCC_PLUS, REDCERT2);
    // left undefined for others. Not enforced against `scheme` here —
    // see the spec for why this stays a soft convention, not a hard
    // DB/Zod constraint.
    massBalanceAllocationPercent: z.coerce.number().min(0).max(100).optional(),
  })
  .refine((c) => c.validUntil > c.validFrom, {
    message: "validUntil must be after validFrom",
    path: ["validUntil"],
  });

export type CertificationInput = z.infer<typeof CertificationInputSchema>;

// ----------------------------------------------------------------------------
// Multi-Tier Chain of Custody (Multi-tier Supply Chain Verification &
// Auditor Portal Expansion) — see prisma/schema.prisma's ChainOfCustodyRecord
// for the full design rationale.
// ----------------------------------------------------------------------------

export const ChainOfCustodyInputSchema = z
  .object({
    tier: z.enum(ChainOfCustodyTier),
    participantName: z.string().min(1, "participantName is required").max(200),
    participantCountry: z.string().max(120).optional(),
    externalBatchId: z.string().min(1, "externalBatchId is required").max(120),

    certificationScheme: z.enum(CertificationScheme).optional(),
    certificateId: z.string().max(120).optional(),
    certificateDocumentUrl: z.string().url().optional(),
    // Same SSRF-avoidance rationale as CertificationInputSchema.documentHash
    // above — computed by whoever uploads the document, never fetched here.
    certificateDocumentHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/i, "certificateDocumentHash must be a 64-character hex SHA-256 digest")
      .optional(),
    massBalanceAllocationPercent: z.coerce.number().min(0).max(100).optional(),

    notes: z.string().max(2000).optional(),
  })
  .refine((d) => !(d.certificateId && !d.certificationScheme), {
    message: "certificationScheme is required when certificateId is provided",
    path: ["certificationScheme"],
  });

export type ChainOfCustodyInput = z.infer<typeof ChainOfCustodyInputSchema>;

// ----------------------------------------------------------------------------
// Polymer Passport claim
// ----------------------------------------------------------------------------

export const PolymerPassportInputSchema = z
  .object({
    polymerType: z.enum(PolymerType),
    grade: z.string().min(1, "grade is required").max(120),
    meltFlowIndex: z.coerce.number().positive().max(9999.99),
    mfiTestStandard: z.string().min(1).default("ISO 1133"),
    density: z.coerce.number().positive().max(99.999),
    densityTestStandard: z.string().min(1).default("ISO 1183"),
    colorAdditives: z.string().max(500).optional(),

    gtin: GtinSchema,

    recycledContentSource: z.enum(RecycledContentSource).optional(),
    recycledContentPercent: z.coerce.number().min(0).max(100).default(0),
    recycledContentCertScheme: z.enum(CertificationScheme).optional(),
    bioBasedPercent: z.coerce.number().min(0).max(100).default(0),
    bioBasedTestStandard: z.string().max(120).optional(),

    carbonFootprintKgCO2ePerKg: z.coerce.number().min(0).max(999999.999).default(0),
    lcaMethodology: z.string().min(1).default("PEF"),
    lcaScope: z.string().min(1).default("cradle-to-gate"),
    lcaThirdPartyVerified: z.coerce.boolean().default(false),
    lcaVerifierName: z.string().max(200).optional(),

    batchId: z
      .string()
      .min(3, "batchId must be at least 3 characters")
      .max(64)
      .regex(/^[A-Za-z0-9._-]+$/, "batchId may only contain letters, numbers, '.', '_' and '-'"),
    manufacturerId: z.string().uuid("manufacturerId must be a valid manufacturer UUID"),
    productionDate: z.coerce.date().default(() => new Date()),
    productionSiteGln: z.string().regex(/^\d{13}$/, "GLN must be exactly 13 digits").optional(),

    certifications: z
      .array(CertificationInputSchema)
      .min(1, "At least one certification is required to issue a passport"),
  })
  .refine((d) => d.recycledContentPercent + d.bioBasedPercent <= 100, {
    message: "recycledContentPercent + bioBasedPercent cannot exceed 100%",
    path: ["bioBasedPercent"],
  })
  .refine((d) => !(d.recycledContentPercent > 0 && !d.recycledContentSource), {
    message: "recycledContentSource is required when recycledContentPercent > 0",
    path: ["recycledContentSource"],
  })
  .refine((d) => !(d.recycledContentPercent > 0 && !d.recycledContentCertScheme), {
    message: "recycledContentCertScheme is required when recycledContentPercent > 0",
    path: ["recycledContentCertScheme"],
  });

export type PolymerPassportInput = z.infer<typeof PolymerPassportInputSchema>;

// ----------------------------------------------------------------------------
// Supplier Onboarding Portal — public submission payload
// ----------------------------------------------------------------------------
// Deliberately looser than PolymerPassportInputSchema above: an external
// supplier submitting through /supplier/submit/[token] doesn't have (and
// shouldn't need) a manufacturerId UUID, doesn't reliably know this
// system's existing batchIds or hold a GS1-assigned GTIN, and may not yet
// have every certification detail to hand. meltFlowIndex/density/GTIN/
// batchId/certification are all optional here — the admin review step
// (lib/services/supplier-submission.ts's approveSupplierSubmission)
// requires the ones PolymerPassportInputSchema itself requires before a
// submission can actually become a passport, filling gaps via reviewer
// overrides where needed. Certification document handling follows the
// exact same convention as CertificationInputSchema above: a URL plus a
// client-computed SHA-256 hash, never fetched server-side.
export const SupplierSubmissionInputSchema = z
  .object({
    polymerType: z.enum(PolymerType),
    grade: z.string().min(1, "grade is required").max(120),
    meltFlowIndex: z.coerce.number().positive().max(9999.99).optional(),
    density: z.coerce.number().positive().max(99.999).optional(),

    // Supplier-suggested only — not validated against the GS1 mod-10
    // check digit or checked for uniqueness here. The admin confirms or
    // overrides both at approval time, when createPassport()'s own
    // PolymerPassportInputSchema enforces those rules for real.
    proposedGtin: z
      .string()
      .regex(/^\d{1,14}$/, "proposedGtin must contain only digits")
      .optional(),
    proposedBatchId: z
      .string()
      .max(64)
      .regex(/^[A-Za-z0-9._-]+$/, "proposedBatchId may only contain letters, numbers, '.', '_' and '-'")
      .optional(),

    recycledContentSource: z.enum(RecycledContentSource).optional(),
    recycledContentPercent: z.coerce.number().min(0).max(100).default(0),
    bioBasedPercent: z.coerce.number().min(0).max(100).default(0),
    carbonFootprintKgCO2ePerKg: z.coerce.number().min(0).max(999999.999).default(0),
    // Batch weight context — not itself a PolymerPassport column; informs
    // the admin's review, matching SupplierSubmission.weightKg's own
    // schema-comment rationale.
    weightKg: z.coerce.number().positive().max(9999999.999).optional(),

    // Proposed certification — a single block, same shape as
    // CertificationInputSchema. All fields optional individually, but the
    // refine() below requires the full set together the moment any one of
    // them is provided, mirroring ChainOfCustodyInputSchema's own
    // "certificateId implies certificationScheme" rule.
    certScheme: z.enum(CertificationScheme).optional(),
    certificateId: z.string().min(1).max(120).optional(),
    issuingBody: z.string().min(1).max(200).optional(),
    certValidFrom: z.coerce.date().optional(),
    certValidUntil: z.coerce.date().optional(),
    certDocumentUrl: z.string().url().optional(),
    certDocumentHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/i, "certDocumentHash must be a 64-character hex SHA-256 digest")
      .optional(),

    supplierNotes: z.string().max(2000).optional(),
  })
  .refine((d) => d.recycledContentPercent + d.bioBasedPercent <= 100, {
    message: "recycledContentPercent + bioBasedPercent cannot exceed 100%",
    path: ["bioBasedPercent"],
  })
  .refine((d) => !(d.recycledContentPercent > 0 && !d.recycledContentSource), {
    // Mirrors PolymerPassportInputSchema's own rule above — enforced here
    // too (not left to fail later at approveSupplierSubmission's call
    // into createPassport) because ApproveSupplierSubmissionOverrides has
    // no recycledContentSource override: if a submission got this far
    // without one, the admin would have no way to fix it at review time.
    message: "recycledContentSource is required when recycledContentPercent > 0",
    path: ["recycledContentSource"],
  })
  .refine(
    (d) => {
      const anyCertField = d.certScheme || d.certificateId || d.issuingBody || d.certValidFrom || d.certValidUntil;
      const allCertFields = d.certScheme && d.certificateId && d.issuingBody && d.certValidFrom && d.certValidUntil;
      return !anyCertField || allCertFields;
    },
    {
      message:
        "certScheme, certificateId, issuingBody, certValidFrom and certValidUntil must all be provided together",
      path: ["certScheme"],
    }
  )
  .refine((d) => !(d.certValidFrom && d.certValidUntil) || d.certValidUntil > d.certValidFrom, {
    message: "certValidUntil must be after certValidFrom",
    path: ["certValidUntil"],
  });

export type SupplierSubmissionInput = z.infer<typeof SupplierSubmissionInputSchema>;

// ----------------------------------------------------------------------------
// Derived numeric helpers — always return Prisma.Decimal
// ----------------------------------------------------------------------------

export function computeTotalRecycledPercent(input: {
  recycledContentPercent: number | string | Prisma.Decimal;
}): Prisma.Decimal {
  return input.recycledContentPercent instanceof Prisma.Decimal
    ? input.recycledContentPercent
    : new Prisma.Decimal(input.recycledContentPercent);
}

// ----------------------------------------------------------------------------
// Canonical hashing
// ----------------------------------------------------------------------------

function stableStringify(value: unknown): string {
  if (value instanceof Prisma.Decimal) {
    return JSON.stringify(value.toFixed());
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(",");
  return `{${body}}`;
}

/**
 * Deterministic SHA-256 over the canonicalized (sorted-key) claim data.
 * Two calls with the same logical data — regardless of key order — always
 * produce the same hash, which is what makes recordHash meaningful as a
 * tamper-evidence seal.
 */
export function hashRecord(data: Record<string, unknown>): string {
  const canonical = stableStringify(data);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
