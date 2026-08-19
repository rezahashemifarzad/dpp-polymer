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

// ----------------------------------------------------------------------------
// GTIN (GS1 mod-10 check digit)
// ----------------------------------------------------------------------------

function gtinCheckDigit(first13Digits: string): number {
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const digit = Number(first13Digits[i]);
    // Rightmost data digit (i = 12) carries weight 3, alternating leftward.
    const weight = (12 - i) % 2 === 0 ? 3 : 1;
    sum += digit * weight;
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidGtin14(gtin: string): boolean {
  if (!/^\d{14}$/.test(gtin)) return false;
  return gtinCheckDigit(gtin.slice(0, 13)) === Number(gtin[13]);
}

export const GtinSchema = z
  .string()
  .length(14, "GTIN must be exactly 14 digits")
  .regex(/^\d{14}$/, "GTIN must contain only digits")
  .refine(isValidGtin14, { message: "GTIN fails the GS1 mod-10 check digit validation" });

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
