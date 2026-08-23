/**
 * lib/services/esg-analytics.ts
 * -----------------------------------------------------------------------
 * Corporate ESG Analytics & Sustainability Dashboard — read-only
 * aggregation over every PolymerPassport, its Certifications, and its
 * (optional) CarbonFootprintCalculation. No new schema, no mutations: this
 * is a pure derived summary, computed fresh on every call — same
 * "compute, don't store" principle already used for certification expiry
 * alerts (lib/utils/certification-status.ts), so there is no cached/stale
 * ESG figure to ever drift from the underlying ledger.
 *
 * IMPORTANT CAVEATS — read before wiring any of these numbers into
 * anything customer- or auditor-facing:
 *
 * 1. Batch mass. PolymerPassport has no first-class "batch weight" field.
 *    The only place a batch's mass is recorded today is
 *    CarbonFootprintCalculation.weightKg, entered by whoever ran the
 *    optional carbon footprint calculator for that batch (see
 *    lib/services/calculate-carbon-footprint.ts). Every mass-based metric
 *    below (PCR mass consumed, tax relief estimate, mass-weighted carbon
 *    totals) is therefore necessarily computed only over the subset of
 *    batches that have a recorded weight — every summary explicitly
 *    reports how many batches were excluded for this reason
 *    (batchesMissingWeightData / batchesWithWeightData) so the numbers are
 *    never silently understated without a visible caveat. If this becomes
 *    a load-bearing metric, the natural fix is a first-class
 *    `PolymerPassport.batchWeightKg` field — flagged here, not added, to
 *    keep this feature additive-only per the project's Baseline Rule.
 *
 * 2. EU Plastic Tax Relief. This is an ILLUSTRATIVE planning estimate,
 *    NOT tax or legal advice. It reuses the €800/tonne figure already
 *    referenced in this app's AI Copilot tab (app/page.tsx's
 *    aiSuggestion text, "Level 1 EU Plastic Packaging Tax Relief") —
 *    which approximates the EU's plastic packaging levy on
 *    non-recycled plastic packaging waste (Council Decision (EU,
 *    Euratom) 2020/2053, €0.80/kg = €800/tonne, levied at member-state
 *    level and not implemented identically as a producer-facing tax in
 *    every country). Real liability depends on jurisdiction, product
 *    category, and national implementation — always route this figure
 *    through a qualified tax advisor before using it beyond internal ESG
 *    reporting. It is computed only against Post-Consumer Recycled (PCR)
 *    mass, matching how the underlying levy mechanism rewards recycled
 *    content specifically.
 *
 * 3. Illustrative carbon estimate. CarbonFootprintCalculation is built
 *    from placeholder emission factors (see
 *    lib/utils/carbon-footprint-calculator.ts's own caveat). It is always
 *    reported here alongside — and clearly distinguished from — the
 *    manufacturer's own verified LCA figure (carbonFootprintKgCO2ePerKg),
 *    never blended into one number.
 */

import { prisma } from "@/lib/prisma";
import { getCertificationAlertLevel } from "@/lib/utils/certification-status";

export const EU_PLASTIC_TAX_RATE_EUR_PER_TONNE = 800;

// A REVOKED passport's claims are withdrawn, and a SUPERSEDED one has been
// replaced by a newer record — counting either into a mass/carbon/
// compliance total would misstate what's actually in circulation. Mirrors
// estimateRiskScore's treatment of REVOKED in app/page.tsx.
const EXCLUDED_STATUSES = new Set(["REVOKED", "SUPERSEDED"]);

export interface EsgMonthlyTrendPoint {
  month: string; // "YYYY-MM", sorted ascending
  batchCount: number;
  avgRecycledContentPercent: number;
  avgVerifiedCarbonIntensityKgCO2ePerKg: number;
}

export interface EsgComplianceBreakdown {
  totalCertifications: number;
  verified: number;
  pendingReview: number;
  rejected: number;
  verifiedPercent: number;
  pendingReviewPercent: number;
  rejectedPercent: number;
  // Sub-breakdown of the VERIFIED bucket only, by expiry — reuses
  // getCertificationAlertLevel (the same helper the admin ledger's expiry
  // badges use), not a stored "EXPIRED" status: there isn't one, by design
  // (see CertificationVerificationStatus's own comment in schema.prisma).
  verifiedCurrentlyValid: number;
  verifiedExpiringSoon: number;
  verifiedExpired: number;
}

export interface EsgPcrMassSummary {
  batchesConsidered: number;
  batchesWithWeightData: number;
  batchesMissingWeightData: number;
  totalMassKg: number;
  pcrMassKg: number; // POST_CONSUMER only
  pirMassKg: number; // POST_INDUSTRIAL only, reported for context — not part of PCR or tax figures
  pcrAdoptionRatePercent: number; // pcrMassKg / totalMassKg, over weighed batches only
}

export interface EsgCarbonSummary {
  batchesWithVerifiedFigure: number;
  batchesWithIllustrativeEstimate: number;
  batchesUsableForMassWeightedTotal: number; // have BOTH a verified figure and a recorded weight
  totalVerifiedKgCO2e: number | null;
  totalIllustrativeEstimateKgCO2e: number | null;
  avgVerifiedIntensityKgCO2ePerKg: number | null;
  thirdPartyVerifiedCount: number;
  thirdPartyVerifiedPercent: number;
}

export interface EsgTaxReliefSummary {
  ratePerTonneEur: number;
  pcrMassTonnes: number;
  estimatedReliefEur: number;
  disclaimer: string;
}

export interface EsgAnalyticsSummary {
  generatedAt: string; // ISO timestamp — a point-in-time snapshot, never stored
  totalBatches: number;
  activeBatches: number;
  excludedBatches: number;
  statusBreakdown: Record<string, number>;
  pcrMass: EsgPcrMassSummary;
  carbon: EsgCarbonSummary;
  taxRelief: EsgTaxReliefSummary;
  compliance: EsgComplianceBreakdown;
  monthlyTrend: EsgMonthlyTrendPoint[];
}

export async function getEsgAnalytics(): Promise<EsgAnalyticsSummary> {
  // Narrow `select` (not a full-row fetch) — this table can grow into the
  // thousands, and every field below is actually used in the aggregation.
  const passports = await prisma.polymerPassport.findMany({
    select: {
      status: true,
      recycledContentSource: true,
      recycledContentPercent: true,
      carbonFootprintKgCO2ePerKg: true,
      lcaThirdPartyVerified: true,
      productionDate: true,
      certifications: {
        select: { verificationStatus: true, validUntil: true },
      },
      carbonFootprintCalculation: {
        select: { weightKg: true, totalKgCO2e: true },
      },
    },
  });

  const totalBatches = passports.length;
  const active = passports.filter((p) => !EXCLUDED_STATUSES.has(p.status));
  const activeBatches = active.length;

  const statusBreakdown: Record<string, number> = {};
  for (const p of passports) {
    statusBreakdown[p.status] = (statusBreakdown[p.status] ?? 0) + 1;
  }

  // --- PCR mass + carbon (mass-weighted metrics only over batches with a
  // recorded weight — see the file banner's caveat #1) ----------------------
  let batchesWithWeightData = 0;
  let totalMassKg = 0;
  let pcrMassKg = 0;
  let pirMassKg = 0;

  let batchesWithVerifiedFigure = 0;
  let batchesWithIllustrativeEstimate = 0;
  let batchesUsableForMassWeightedTotal = 0;
  let totalVerifiedKgCO2e = 0;
  let totalIllustrativeEstimateKgCO2e = 0;
  let verifiedIntensitySum = 0;
  let verifiedIntensityCount = 0;
  let thirdPartyVerifiedCount = 0;

  for (const p of active) {
    const weightKg = p.carbonFootprintCalculation ? Number(p.carbonFootprintCalculation.weightKg) : null;
    const recycledPercent = Number(p.recycledContentPercent);
    const verifiedIntensity = Number(p.carbonFootprintKgCO2ePerKg);

    if (weightKg !== null && weightKg > 0) {
      batchesWithWeightData++;
      totalMassKg += weightKg;
      if (p.recycledContentSource === "POST_CONSUMER") {
        pcrMassKg += weightKg * (recycledPercent / 100);
      } else if (p.recycledContentSource === "POST_INDUSTRIAL") {
        pirMassKg += weightKg * (recycledPercent / 100);
      }
    }

    // carbonFootprintKgCO2ePerKg defaults to 0 when never entered, so > 0
    // is used as "has a verified figure" — a batch that's genuinely 0
    // kg CO2e/kg is not a realistic real-world value for this field.
    if (verifiedIntensity > 0) {
      batchesWithVerifiedFigure++;
      verifiedIntensitySum += verifiedIntensity;
      verifiedIntensityCount++;
      if (p.lcaThirdPartyVerified) thirdPartyVerifiedCount++;
      if (weightKg !== null && weightKg > 0) {
        batchesUsableForMassWeightedTotal++;
        totalVerifiedKgCO2e += verifiedIntensity * weightKg;
      }
    }

    if (p.carbonFootprintCalculation) {
      batchesWithIllustrativeEstimate++;
      totalIllustrativeEstimateKgCO2e += Number(p.carbonFootprintCalculation.totalKgCO2e);
    }
  }

  const pcrMass: EsgPcrMassSummary = {
    batchesConsidered: activeBatches,
    batchesWithWeightData,
    batchesMissingWeightData: activeBatches - batchesWithWeightData,
    totalMassKg: round2(totalMassKg),
    pcrMassKg: round2(pcrMassKg),
    pirMassKg: round2(pirMassKg),
    pcrAdoptionRatePercent: totalMassKg > 0 ? round2((pcrMassKg / totalMassKg) * 100) : 0,
  };

  const carbon: EsgCarbonSummary = {
    batchesWithVerifiedFigure,
    batchesWithIllustrativeEstimate,
    batchesUsableForMassWeightedTotal,
    totalVerifiedKgCO2e: batchesUsableForMassWeightedTotal > 0 ? round2(totalVerifiedKgCO2e) : null,
    totalIllustrativeEstimateKgCO2e:
      batchesWithIllustrativeEstimate > 0 ? round2(totalIllustrativeEstimateKgCO2e) : null,
    avgVerifiedIntensityKgCO2ePerKg:
      verifiedIntensityCount > 0 ? round3(verifiedIntensitySum / verifiedIntensityCount) : null,
    thirdPartyVerifiedCount,
    thirdPartyVerifiedPercent: batchesWithVerifiedFigure > 0 ? round2((thirdPartyVerifiedCount / batchesWithVerifiedFigure) * 100) : 0,
  };

  const pcrMassTonnes = pcrMass.pcrMassKg / 1000;
  const taxRelief: EsgTaxReliefSummary = {
    ratePerTonneEur: EU_PLASTIC_TAX_RATE_EUR_PER_TONNE,
    pcrMassTonnes: round3(pcrMassTonnes),
    estimatedReliefEur: round2(pcrMassTonnes * EU_PLASTIC_TAX_RATE_EUR_PER_TONNE),
    disclaimer:
      "Illustrative estimate only, not tax or legal advice. Based on €800/tonne applied to Post-Consumer " +
      "Recycled mass across batches with a recorded weight. Actual liability depends on jurisdiction and " +
      "national implementation — consult a qualified tax advisor.",
  };

  // --- Compliance breakdown (every certification on every active batch) ---
  const allCerts = active.flatMap((p) => p.certifications);
  const totalCertifications = allCerts.length;
  let verified = 0;
  let pendingReview = 0;
  let rejected = 0;
  let verifiedCurrentlyValid = 0;
  let verifiedExpiringSoon = 0;
  let verifiedExpired = 0;

  for (const c of allCerts) {
    if (c.verificationStatus === "VERIFIED") {
      verified++;
      const level = getCertificationAlertLevel(c.validUntil);
      if (level === "EXPIRED") verifiedExpired++;
      else if (level === "EXPIRING_SOON") verifiedExpiringSoon++;
      else verifiedCurrentlyValid++;
    } else if (c.verificationStatus === "PENDING_REVIEW") {
      pendingReview++;
    } else if (c.verificationStatus === "REJECTED") {
      rejected++;
    }
  }

  const compliance: EsgComplianceBreakdown = {
    totalCertifications,
    verified,
    pendingReview,
    rejected,
    verifiedPercent: pct(verified, totalCertifications),
    pendingReviewPercent: pct(pendingReview, totalCertifications),
    rejectedPercent: pct(rejected, totalCertifications),
    verifiedCurrentlyValid,
    verifiedExpiringSoon,
    verifiedExpired,
  };

  // --- Monthly trend, bucketed by productionDate ---------------------------
  const buckets = new Map<
    string,
    { count: number; recycledSum: number; carbonSum: number; carbonCount: number }
  >();
  for (const p of active) {
    const month = p.productionDate.toISOString().slice(0, 7); // "YYYY-MM"
    const bucket = buckets.get(month) ?? { count: 0, recycledSum: 0, carbonSum: 0, carbonCount: 0 };
    bucket.count++;
    bucket.recycledSum += Number(p.recycledContentPercent);
    const intensity = Number(p.carbonFootprintKgCO2ePerKg);
    if (intensity > 0) {
      bucket.carbonSum += intensity;
      bucket.carbonCount++;
    }
    buckets.set(month, bucket);
  }
  const monthlyTrend: EsgMonthlyTrendPoint[] = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, b]) => ({
      month,
      batchCount: b.count,
      avgRecycledContentPercent: round2(b.recycledSum / b.count),
      avgVerifiedCarbonIntensityKgCO2ePerKg: b.carbonCount > 0 ? round3(b.carbonSum / b.carbonCount) : 0,
    }));

  return {
    generatedAt: new Date().toISOString(),
    totalBatches,
    activeBatches,
    excludedBatches: totalBatches - activeBatches,
    statusBreakdown,
    pcrMass,
    carbon,
    taxRelief,
    compliance,
    monthlyTrend,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
function pct(part: number, total: number): number {
  return total > 0 ? round2((part / total) * 100) : 0;
}
