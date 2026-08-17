/**
 * DPP-Polymer — TypeScript Types & Validation Layer (Phase 1)
 * -----------------------------------------------------------------------
 * This file is the API-boundary counterpart to schema.prisma.
 * - Zod schemas validate incoming/outgoing DPP payloads.
 * - hashRecord() produces the canonical SHA-256 hash stored in
 *   PolymerPassport.recordHash. Canonicalization matters: field order
 *   must be deterministic or the same logical record will hash
 *   differently across requests, breaking integrity verification.
 */

import { z } from "zod";
import { createHash } from "crypto";

// ----------------------------------------------------------------------------
// Enums (mirror Prisma enums — kept in sync manually until we wire up
// prisma-zod-generator in a later milestone)
// ----------------------------------------------------------------------------

export const PolymerType = z.enum([
  "PET", "HDPE", "PVC", "LDPE", "PP", "PS", "PLA", "PHA", "PA", "PC", "ABS", "OTHER",
]);
export type PolymerType = z.infer<typeof PolymerType>;

export const RecycledContentSource = z.enum([
  "POST_CONSUMER", "POST_INDUSTRIAL", "VIRGIN", "BIO_BASED",
]);
export type RecycledContentSource = z.infer<typeof RecycledContentSource>;

export const CertificationScheme = z.enum([
  "ISCC_PLUS", "REDCERT2", "ISO_14021", "ISO_14040_44", "EN_15343", "EN_16785", "GRS", "RECYCLASS", "OTHER",
]);
export type CertificationScheme = z.infer<typeof CertificationScheme>;

export const DppStatus = z.enum([
  "DRAFT", "PENDING_VERIFICATION", "ISSUED", "REVOKED", "SUPERSEDED",
]);
export type DppStatus = z.infer<typeof DppStatus>;

// ----------------------------------------------------------------------------
// GS1 GTIN utilities
// ----------------------------------------------------------------------------

/**
 * Left-pads a GTIN-8/12/13 to the canonical 14-digit GTIN-14 form GS1
 * Digital Link expects in the /01/{gtin}/ path segment. Already-14-digit
 * input passes through unchanged.
 */
export function padGtinTo14(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.padStart(14, "0");
}

/**
 * Validates the GS1 check digit (mod-10, weights alternating 3/1 from the
 * rightmost digit). Catches transcription errors (e.g. a digit typo on a
 * batch label) before they're baked into an issued passport's QR code.
 */
export function isValidGtinCheckDigit(gtin14: string): boolean {
  if (!/^\d{14}$/.test(gtin14)) return false;
  const digits = gtin14.split("").map(Number);
  const checkDigit = digits.pop()!;
  const sum = digits
    .reverse()
    .reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  const computed = (10 - (sum % 10)) % 10;
  return computed === checkDigit;
}

/** Zod schema for a GTIN field: accepts GTIN-8/12/13/14 input, normalizes to 14 digits, verifies check digit. */
export const GtinSchema = z
  .string()
  .transform((v) => padGtinTo14(v))
  .refine((v) => /^\d{14}$/.test(v), { message: "GTIN must contain 8, 12, 13, or 14 digits" })
  .refine((v) => isValidGtinCheckDigit(v), { message: "Invalid GTIN check digit" });

// ----------------------------------------------------------------------------
// Sub-schemas
// ----------------------------------------------------------------------------

export const CertificationSchema = z.object({
  scheme: CertificationScheme,
  certificateId: z.string().min(1),
  issuingBody: z.string().min(1),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
  documentUrl: z.string().url().optional(),
}).refine((c) => c.validUntil > c.validFrom, {
  message: "validUntil must be after validFrom",
});
export type Certification = z.infer<typeof CertificationSchema>;

// ----------------------------------------------------------------------------
// Core Passport Schema
// ----------------------------------------------------------------------------

export const PolymerPassportInputSchema = z.object({
  // 1. Material Identification
  polymerType: PolymerType,
  grade: z.string().min(1),
  meltFlowIndex: z.number().positive(),
  mfiTestStandard: z.string().default("ISO 1133"),
  density: z.number().positive(),
  densityTestStandard: z.string().default("ISO 1183"),
  colorAdditives: z.string().optional(),
  gtin: GtinSchema, // normalized to 14 digits; drives the QR Digital Link path

  // 2. Sustainability & Recycled Content
  // Flat fields: one dominant recycled source per batch (confirmed — no
  // mass-balance blending needed for Phase 1).
  recycledContentSource: RecycledContentSource.optional(), // omit/undefined if recycledContentPercent is 0
  recycledContentPercent: z.number().min(0).max(100).default(0),
  recycledContentCertScheme: CertificationScheme.optional(),
  bioBasedPercent: z.number().min(0).max(100).default(0),
  bioBasedTestStandard: z.string().optional(),
  carbonFootprintKgCO2ePerKg: z.number().nonnegative(),
  lcaMethodology: z.string().default("PEF"),
  lcaScope: z.literal("cradle-to-gate").default("cradle-to-gate"), // fixed scope for Phase 1
  lcaThirdPartyVerified: z.boolean().default(false),
  lcaVerifierName: z.string().optional(),

  // 3. Supply Chain & Certification
  batchId: z.string().min(1),
  manufacturerId: z.string().uuid(),
  productionDate: z.coerce.date(),
  productionSiteGln: z.string().optional(),
  certifications: z.array(CertificationSchema).min(1),
}).superRefine((data, ctx) => {
  // Cross-field validation the DB layer can't enforce alone: recycled % +
  // bio-based % can't exceed 100 (remainder is implicitly virgin material).
  const sum = data.recycledContentPercent + data.bioBasedPercent;
  if (sum > 100.5) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `recycledContentPercent + bioBasedPercent cannot exceed 100 (got ${sum})`,
      path: ["recycledContentPercent"],
    });
  }
  if (data.recycledContentPercent > 0 && !data.recycledContentSource) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `recycledContentSource is required when recycledContentPercent > 0`,
      path: ["recycledContentSource"],
    });
  }
});
export type PolymerPassportInput = z.infer<typeof PolymerPassportInputSchema>;

/** Full record shape, including server-generated integrity fields. */
export const PolymerPassportRecordSchema = PolymerPassportInputSchema.innerType().extend({
  id: z.string().uuid(),
  totalRecycledPercent: z.number(),
  recordHash: z.string(),
  hashAlgorithm: z.literal("SHA-256").default("SHA-256"),
  previousRecordHash: z.string().nullable().optional(),
  signedAt: z.coerce.date().nullable().optional(),
  signedBy: z.string().nullable().optional(),
  status: DppStatus.default("DRAFT"),
  qrCodePayloadUrl: z.string().url().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type PolymerPassportRecord = z.infer<typeof PolymerPassportRecordSchema>;

// ----------------------------------------------------------------------------
// Derived value helpers
// ----------------------------------------------------------------------------

/**
 * Mirrors totalRecycledPercent onto recycledContentPercent. Kept as a
 * function (not a straight alias) so a second recycled stream can be
 * introduced later without changing every call site.
 */
export function computeTotalRecycledPercent(input: { recycledContentPercent: number }): number {
  return input.recycledContentPercent;
}

// ----------------------------------------------------------------------------
// Cryptographic Integrity
// ----------------------------------------------------------------------------

/**
 * Canonicalizes a passport payload into a deterministic JSON string.
 * Sorts object keys recursively so field ordering in application code
 * never affects the resulting hash.
 */
function canonicalize(value: unknown): string {
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`
  );
  return `{${entries.join(",")}}`;
}

/**
 * Produces the SHA-256 hash stored in PolymerPassport.recordHash.
 * IMPORTANT: only hash the fields that represent the *substantive claim*
 * (exclude mutable metadata like updatedAt, qrCodePayloadUrl) so the hash
 * stays stable across non-substantive writes.
 */
export function hashRecord(
  record: Omit<
    PolymerPassportInput,
    never
  > & { totalRecycledPercent: number }
): string {
  const canonical = canonicalize(record);
  return createHash("sha256").update(canonical).digest("hex");
}

/** Verifies a stored record hasn't been tampered with. */
export function verifyRecordHash(
  record: Omit<PolymerPassportInput, never> & { totalRecycledPercent: number },
  expectedHash: string
): boolean {
  return hashRecord(record) === expectedHash;
}
