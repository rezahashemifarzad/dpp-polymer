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

// FIX (Circular Economy Platform Upgrade, Step 4): params/searchParams are
// Promises in this Next.js 16 App Router repo (see AGENTS.md — every other
// dynamic route already follows this), but this file was still typed and
// destructured synchronously. Left un-awaited, `params.serialOrBatch` and
// `searchParams.v` are both `undefined` at runtime, so `getVerifiedPassport`
// was being called with batchId "undefined" on every real scan — the actual
// GS1/QR resolver 404ing in production. Fixed below.
interface PageProps {
  params: Promise<{ gtin: string; serialOrBatch: string }>;
  searchParams: Promise<{ v?: string }>;
}

export default async function Gs1ResolverPage({ params, searchParams }: PageProps) {
  const { gtin, serialOrBatch } = await params;
  const { v } = await searchParams;

  const batchId = decodeURIComponent(serialOrBatch);
  const result = await getVerifiedPassport(batchId);

  if (!result) notFound();
  const { passport, integrityVerified } = result;

  const gtinMatches = padGtinTo14(gtin) === passport.gtin;
  const tokenMatches = v === deriveVerificationToken(passport.recordHash);
  const linkTrusted = gtinMatches && tokenMatches;

  // Third-Party Auditor Verification Workflow — surface the latest review
  // event ONLY when it is a positive sign-off. auditorVerifications is
  // already narrowed to "latest one" by lib/verifyPassport.ts's query; a
  // REJECTED_BY_AUDITOR record (or no review yet) intentionally becomes
  // `null` here — the public page never displays a rejection as any kind
  // of trust signal (see components/PublicScanPage.tsx's file banner on
  // that section).
  const latestVerification = passport.auditorVerifications[0] ?? null;
  const auditorSignOff =
    latestVerification && latestVerification.status === "AUDITOR_VERIFIED"
      ? {
          auditorName: latestVerification.auditor.name,
          auditorOrganization: latestVerification.auditor.organization,
          signedAt: latestVerification.signedAt.toISOString(),
        }
      : null;

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
        // FIX (Step 4, discovered while touching this file): the public page
        // was rendering every certification regardless of
        // verificationStatus, including a manufacturer's own unverified
        // PENDING_REVIEW submissions — the exact "never show unverified
        // claims as fact" rule the Compliance module established for
        // certifications generally (see
        // docs/COMPLIANCE_CERTIFICATIONS_MODULE_SPEC.md). Filtered to
        // VERIFIED-only here, at the one place the consumer-facing view is
        // built, so a REJECTED or still-pending certification can never
        // read as a green claim on a scan.
        certifications: passport.certifications
          .filter((c) => c.verificationStatus === "VERIFIED")
          .map((c) => ({
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
        // Circular Economy Platform Upgrade (Step 4) additions.
        parentLinks: passport.parentLinks.map((link) => ({
          id: link.id,
          quantityUsedKg: link.quantityUsedKg !== null ? Number(link.quantityUsedKg) : null,
          notes: link.notes,
          parentPassport: {
            batchId: link.parentPassport.batchId,
            gtin: link.parentPassport.gtin,
            polymerType: link.parentPassport.polymerType,
            grade: link.parentPassport.grade,
            recycledContentPercent: Number(link.parentPassport.recycledContentPercent),
          },
        })),
        carbonFootprintCalculation: passport.carbonFootprintCalculation
          ? {
              scope1KgCO2e: Number(passport.carbonFootprintCalculation.scope1KgCO2e),
              scope2KgCO2e: Number(passport.carbonFootprintCalculation.scope2KgCO2e),
              scope3KgCO2e: Number(passport.carbonFootprintCalculation.scope3KgCO2e),
              totalKgCO2e: Number(passport.carbonFootprintCalculation.totalKgCO2e),
              weightKg: Number(passport.carbonFootprintCalculation.weightKg),
              transportMode: passport.carbonFootprintCalculation.transportMode,
              emissionFactorVersion: passport.carbonFootprintCalculation.emissionFactorVersion,
            }
          : null,
      }}
      integrityVerified={integrityVerified}
      linkTrusted={linkTrusted}
      auditorSignOff={auditorSignOff}
    />
  );
}
