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
import type { PolymerPassport, Certification, CarbonFootprintCalculation } from "@prisma/client";

// Third-Party Auditor Verification Workflow — the latest sign-off event
// for this passport, if any. Narrow `select` on the auditor relation
// (name/organization only) since this is what the public scan page is
// allowed to show — see components/PublicScanPage.tsx, which additionally
// only renders this when status is AUDITOR_VERIFIED (a REJECTED_BY_AUDITOR
// record is never surfaced as a public trust signal).
export interface LatestAuditorVerification {
  id: string;
  status: string; // AuditorVerificationStatus
  signedAt: Date;
  auditor: { name: string; organization: string };
}

// Circular Economy Platform Upgrade (Step 4) — genealogy parent summaries are
// intentionally a narrow `select`, not the full PolymerPassport, since the
// public scan page only ever renders a lineage list, never a parent's full
// dossier (a parent batch may belong to a different manufacturer entirely).
export interface GenealogyParentSummary {
  id: string;
  batchId: string;
  gtin: string;
  polymerType: string;
  grade: string;
  recycledContentPercent: unknown; // Prisma.Decimal — convert with Number() at the UI boundary
  qrCodePayloadUrl: string | null;
}

export type PassportWithRelations = PolymerPassport & {
  certifications: Certification[];
  manufacturer: { id: string; legalName: string; country: string; gln: string | null };
  parentLinks: Array<{
    id: string;
    quantityUsedKg: unknown; // Prisma.Decimal | null
    notes: string | null;
    parentPassport: GenealogyParentSummary;
  }>;
  carbonFootprintCalculation: CarbonFootprintCalculation | null;
  auditorVerifications: LatestAuditorVerification[]; // latest first, at most 1 (see query below)
};

export interface VerifiedPassportResult {
  passport: PassportWithRelations;
  integrityVerified: boolean;
}

export async function getVerifiedPassport(batchId: string): Promise<VerifiedPassportResult | null> {
  const passport = await prisma.polymerPassport.findUnique({
    where: { batchId },
    include: {
      certifications: true,
      manufacturer: true,
      parentLinks: {
        include: {
          parentPassport: {
            select: {
              id: true,
              batchId: true,
              gtin: true,
              polymerType: true,
              grade: true,
              recycledContentPercent: true,
              qrCodePayloadUrl: true,
            },
          },
        },
      },
      carbonFootprintCalculation: true,
      // Third-Party Auditor Verification Workflow — only the single most
      // recent review event. A passport may have multiple historical
      // AuditorVerification rows (a re-review after correction); the
      // "current" sign-off state is always just the latest one, resolved
      // here at read time rather than cached on PolymerPassport itself
      // (this app's established "compute, don't store" convention).
      auditorVerifications: {
        orderBy: { signedAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          signedAt: true,
          auditor: { select: { name: true, organization: true } },
        },
      },
    },
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
