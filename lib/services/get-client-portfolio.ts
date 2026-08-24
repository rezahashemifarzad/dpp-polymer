/**
 * lib/services/get-client-portfolio.ts
 * -----------------------------------------------------------------------
 * Read-only aggregation of everything a single buyer (Client) has
 * purchased — the shared core behind both the B2B Client Portal
 * (app/client-portal/page.tsx) and the Buyer API
 * (app/api/v1/client/passports/route.ts). One implementation, so the
 * numbers a buyer sees in the portal and the numbers their ERP pulls via
 * the API can never drift apart.
 *
 * Same "compute, don't store" convention as lib/services/esg-analytics.ts
 * and lib/utils/certification-status.ts — nothing here is cached; every
 * call re-derives the summary from ClientPassportAccess + the current
 * PolymerPassport/Certification/CarbonFootprintCalculation state.
 *
 * PCR mass caveat: identical to esg-analytics.ts's caveat #1 —
 * PolymerPassport has no first-class batch-weight field, so mass metrics
 * only cover the subset of this buyer's batches that have a recorded
 * CarbonFootprintCalculation.weightKg. batchesWithWeightData /
 * batchesMissingWeightData is always reported alongside so the total is
 * never silently understated.
 *
 * Certification trust rule: mirrors the public scan page and the PDF
 * certificate export — only VERIFIED certifications count toward
 * "verifiedCertifications" and the expiry alert. A buyer relying on this
 * for compliance reporting should never have a PENDING_REVIEW or
 * REJECTED certification read as a green claim.
 */

import { prisma } from "@/lib/prisma";
import { getPassportCertificationAlert, type PassportCertificationAlert } from "@/lib/utils/certification-status";

// Multi-tier Supply Chain Verification & Auditor Portal Expansion — a
// buyer-facing summary of one tier record. Same VERIFIED-only trust rule
// as verifiedCertifications above: a client relying on this portal for
// their own compliance reporting should never see a PENDING_REVIEW,
// FLAGGED, or REJECTED tier read as a confirmed supply-chain fact.
export interface ClientPortfolioChainOfCustodyRecord {
  id: string;
  sequence: number;
  tier: string;
  participantName: string;
  participantCountry: string | null;
  externalBatchId: string;
  certificationScheme: string | null;
  massBalanceAllocationPercent: number | null;
  reviewedAt: string | null;
}

export interface ClientPortfolioBatch {
  batchId: string;
  gtin: string;
  polymerType: string;
  grade: string;
  status: string;
  recycledContentSource: string | null;
  recycledContentPercent: number;
  bioBasedPercent: number;
  carbonFootprintKgCO2ePerKg: number;
  lcaThirdPartyVerified: boolean;
  productionDate: string;
  manufacturer: { legalName: string; country: string };
  quantityKg: number | null;
  purchaseDate: string;
  notes: string | null;
  verifiedCertifications: number;
  totalCertifications: number;
  certificationAlert: PassportCertificationAlert; // computed over VERIFIED certs only — see file banner
  qrCodePayloadUrl: string | null;
  certificatePdfUrl: string;
  chainOfCustody: ClientPortfolioChainOfCustodyRecord[]; // VERIFIED-only, see this block's own comment
}

export interface ClientPortfolioPcrMass {
  batchesConsidered: number;
  batchesWithWeightData: number;
  batchesMissingWeightData: number;
  totalMassKg: number;
  pcrMassKg: number; // POST_CONSUMER only, same convention as esg-analytics.ts
  pcrAdoptionRatePercent: number;
}

export interface ClientPortfolioSummary {
  generatedAt: string;
  client: { id: string; companyName: string; country: string | null };
  totalBatches: number;
  statusBreakdown: Record<string, number>;
  pcrMass: ClientPortfolioPcrMass;
  verifiedBatchesPercent: number; // % of batches with status ISSUED
  batches: ClientPortfolioBatch[];
}

export type GetClientPortfolioResult = ClientPortfolioSummary | null; // null = no such client

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function getClientPortfolio(clientId: string): Promise<GetClientPortfolioResult> {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return null;

  const accessRows = await prisma.clientPassportAccess.findMany({
    where: { clientId },
    orderBy: { purchaseDate: "desc" },
    include: {
      passport: {
        include: {
          manufacturer: { select: { legalName: true, country: true } },
          certifications: { select: { verificationStatus: true, validUntil: true } },
          carbonFootprintCalculation: { select: { weightKg: true } },
          chainOfCustodyRecords: {
            where: { status: "VERIFIED" },
            orderBy: { sequence: "asc" },
            select: {
              id: true,
              sequence: true,
              tier: true,
              participantName: true,
              participantCountry: true,
              externalBatchId: true,
              certificationScheme: true,
              massBalanceAllocationPercent: true,
              reviewedAt: true,
            },
          },
        },
      },
    },
  });

  const statusBreakdown: Record<string, number> = {};
  let batchesWithWeightData = 0;
  let totalMassKg = 0;
  let pcrMassKg = 0;
  let issuedCount = 0;

  const batches: ClientPortfolioBatch[] = accessRows.map((access) => {
    const p = access.passport;
    statusBreakdown[p.status] = (statusBreakdown[p.status] ?? 0) + 1;
    if (p.status === "ISSUED") issuedCount++;

    const weightKg = p.carbonFootprintCalculation ? Number(p.carbonFootprintCalculation.weightKg) : null;
    const recycledPercent = Number(p.recycledContentPercent);
    if (weightKg !== null && weightKg > 0) {
      batchesWithWeightData++;
      totalMassKg += weightKg;
      if (p.recycledContentSource === "POST_CONSUMER") {
        pcrMassKg += weightKg * (recycledPercent / 100);
      }
    }

    const verifiedCerts = p.certifications.filter((c) => c.verificationStatus === "VERIFIED");

    return {
      batchId: p.batchId,
      gtin: p.gtin,
      polymerType: p.polymerType,
      grade: p.grade,
      status: p.status,
      recycledContentSource: p.recycledContentSource,
      recycledContentPercent: recycledPercent,
      bioBasedPercent: Number(p.bioBasedPercent),
      carbonFootprintKgCO2ePerKg: Number(p.carbonFootprintKgCO2ePerKg),
      lcaThirdPartyVerified: p.lcaThirdPartyVerified,
      productionDate: p.productionDate.toISOString(),
      manufacturer: { legalName: p.manufacturer?.legalName ?? "Unknown", country: p.manufacturer?.country ?? "" },
      quantityKg: access.quantityKg !== null ? Number(access.quantityKg) : null,
      purchaseDate: access.purchaseDate.toISOString(),
      notes: access.notes,
      verifiedCertifications: verifiedCerts.length,
      totalCertifications: p.certifications.length,
      certificationAlert: getPassportCertificationAlert(verifiedCerts),
      qrCodePayloadUrl: p.qrCodePayloadUrl,
      certificatePdfUrl: `/api/passports/${encodeURIComponent(p.batchId)}/certificate.pdf`,
      chainOfCustody: p.chainOfCustodyRecords.map((r) => ({
        id: r.id,
        sequence: r.sequence,
        tier: r.tier,
        participantName: r.participantName,
        participantCountry: r.participantCountry,
        externalBatchId: r.externalBatchId,
        certificationScheme: r.certificationScheme,
        massBalanceAllocationPercent:
          r.massBalanceAllocationPercent !== null ? Number(r.massBalanceAllocationPercent) : null,
        reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      })),
    };
  });

  const totalBatches = accessRows.length;

  return {
    generatedAt: new Date().toISOString(),
    client: { id: client.id, companyName: client.companyName, country: client.country },
    totalBatches,
    statusBreakdown,
    pcrMass: {
      batchesConsidered: totalBatches,
      batchesWithWeightData,
      batchesMissingWeightData: totalBatches - batchesWithWeightData,
      totalMassKg: round2(totalMassKg),
      pcrMassKg: round2(pcrMassKg),
      pcrAdoptionRatePercent: totalMassKg > 0 ? round2((pcrMassKg / totalMassKg) * 100) : 0,
    },
    verifiedBatchesPercent: totalBatches > 0 ? round2((issuedCount / totalBatches) * 100) : 0,
    batches,
  };
}
