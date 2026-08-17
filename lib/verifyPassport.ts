/**
 * lib/verifyPassport.ts
 * -----------------------------------------------------------------------
 * Single source of truth for "fetch a passport + prove its hash still
 * matches its data." Used by:
 *   - GET /api/passports/[batchId]  (route.get.ts)
 *   - the public GS1 resolver page  (app/01/[gtin]/21/[serialOrBatch]/page.tsx)
 *
 * Previously this recompute logic lived duplicated inside the API route.
 * Duplicating it risked the two call sites silently drifting (e.g. one
 * gets updated to include a new field in the hash, the other doesn't),
 * which would make "integrityVerified" lie. Centralizing it here means
 * there is exactly one place that defines what "the record" means for
 * hashing purposes.
 */

import { prisma } from "./prisma";
import { hashRecord, computeTotalRecycledPercent } from "./types";
import type { PolymerPassport, Certification } from "@prisma/client";

export type PassportWithRelations = PolymerPassport & {
  certifications: Certification[];
  manufacturer: { id: string; legalName: string; country: string; gln: string | null };
};

export interface VerifiedPassportResult {
  passport: PassportWithRelations;
  integrityVerified: boolean;
}

export async function getVerifiedPassport(batchId: string): Promise<VerifiedPassportResult | null> {
  const passport = await prisma.polymerPassport.findUnique({
    where: { batchId },
    include: { certifications: true, manufacturer: true },
  });
  if (!passport) return null;

  const recomputed = hashRecord({
    polymerType: passport.polymerType,
    grade: passport.grade,
    meltFlowIndex: Number(passport.meltFlowIndex),
    mfiTestStandard: passport.mfiTestStandard,
    density: Number(passport.density),
    densityTestStandard: passport.densityTestStandard,
    colorAdditives: passport.colorAdditives ?? undefined,
    gtin: passport.gtin,

    recycledContentSource: passport.recycledContentSource ?? undefined,
    recycledContentPercent: Number(passport.recycledContentPercent),
    recycledContentCertScheme: passport.recycledContentCertScheme ?? undefined,
    bioBasedPercent: Number(passport.bioBasedPercent),
    bioBasedTestStandard: passport.bioBasedTestStandard ?? undefined,

    carbonFootprintKgCO2ePerKg: Number(passport.carbonFootprintKgCO2ePerKg),
    lcaMethodology: passport.lcaMethodology,
    lcaScope: "cradle-to-gate",
    lcaThirdPartyVerified: passport.lcaThirdPartyVerified,
    lcaVerifierName: passport.lcaVerifierName ?? undefined,

    batchId: passport.batchId,
    manufacturerId: passport.manufacturerId,
    productionDate: passport.productionDate,
    productionSiteGln: passport.productionSiteGln ?? undefined,

    certifications: passport.certifications.map((c) => ({
      scheme: c.scheme,
      certificateId: c.certificateId,
      issuingBody: c.issuingBody,
      validFrom: c.validFrom,
      validUntil: c.validUntil,
      documentUrl: c.documentUrl ?? undefined,
    })),

    totalRecycledPercent: computeTotalRecycledPercent({
      recycledContentPercent: Number(passport.recycledContentPercent),
    }),
  });

  return { passport, integrityVerified: recomputed === passport.recordHash };
}
