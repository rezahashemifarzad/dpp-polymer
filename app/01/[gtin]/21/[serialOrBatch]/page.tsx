/**
 * app/01/[gtin]/21/[serialOrBatch]/page.tsx
 * -----------------------------------------------------------------------
 * Resolves GS1 Digital Link URLs of the form:
 *   /01/{GTIN}/21/{SerialOrBatch}?v={token}
 * This is the exact path QR.ts encodes into every issued passport's QR
 * code — literal "01"/"21" folders are what make this a spec-compliant
 * GS1 resolver rather than an arbitrary app route.
 *
 * Two independent checks happen before rendering, both surfaced to the
 * visitor rather than hidden:
 *   1. integrityVerified — does the stored recordHash match a hash
 *      recomputed from the stored data right now? (proves the DB row
 *      itself hasn't been tampered with)
 *   2. linkTrusted — do the GTIN and token *in the scanned URL* match
 *      this record? (proves the QR code / label itself hasn't been
 *      swapped or the batch relabeled with a different GTIN)
 * These are deliberately separate signals — a relabeled product with an
 * otherwise-untampered database record should NOT read as "verified".
 */

import { notFound } from "next/navigation";
import { getVerifiedPassport } from "@/lib/verifyPassport";
import { deriveVerificationToken } from "@/lib/qr";
import { padGtinTo14 } from "@/lib/types";
import PublicScanPage from "@/components/PublicScanPage";

// Integrity checking must reflect the current DB state on every scan —
// never serve a cached/stale verification result.
export const revalidate = 0;
export const dynamic = "force-dynamic";

interface PageProps {
  params: { gtin: string; serialOrBatch: string };
  searchParams: { v?: string };
}

export default async function Gs1ResolverPage({ params, searchParams }: PageProps) {
  const batchId = decodeURIComponent(params.serialOrBatch);
  const result = await getVerifiedPassport(batchId);

  if (!result) notFound();
  const { passport, integrityVerified } = result;

  const gtinMatches = padGtinTo14(params.gtin) === passport.gtin;
  const tokenMatches = searchParams.v === deriveVerificationToken(passport.recordHash);
  const linkTrusted = gtinMatches && tokenMatches;

  // Convert Prisma Decimal fields to plain numbers — required for passing
  // props from a Server Component into a Client Component (Decimal
  // instances aren't serializable across that boundary).
  return (
    <PublicScanPage
      passport={{
        polymerType: passport.polymerType,
        grade: passport.grade,
        gtin: passport.gtin,
        meltFlowIndex: Number(passport.meltFlowIndex),
        mfiTestStandard: passport.mfiTestStandard,
        density: Number(passport.density),
        densityTestStandard: passport.densityTestStandard,
        recycledContentSource: passport.recycledContentSource,
        recycledContentPercent: Number(passport.recycledContentPercent),
        bioBasedPercent: Number(passport.bioBasedPercent),
        carbonFootprintKgCO2ePerKg: Number(passport.carbonFootprintKgCO2ePerKg),
        lcaMethodology: passport.lcaMethodology,
        lcaScope: passport.lcaScope,
        lcaThirdPartyVerified: passport.lcaThirdPartyVerified,
        lcaVerifierName: passport.lcaVerifierName,
        batchId: passport.batchId,
        productionDate: passport.productionDate.toISOString(),
        status: passport.status,
        manufacturer: {
          legalName: passport.manufacturer.legalName,
          country: passport.manufacturer.country,
        },
        certifications: passport.certifications.map((c) => ({
          scheme: c.scheme,
          certificateId: c.certificateId,
          issuingBody: c.issuingBody,
          validFrom: c.validFrom.toISOString(),
          validUntil: c.validUntil.toISOString(),
          documentUrl: c.documentUrl,
        })),
        recordHash: passport.recordHash,
        hashAlgorithm: passport.hashAlgorithm,
        previousRecordHash: passport.previousRecordHash,
        signedAt: passport.signedAt ? passport.signedAt.toISOString() : null,
      }}
      integrityVerified={integrityVerified}
      linkTrusted={linkTrusted}
    />
  );
}
