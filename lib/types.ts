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
