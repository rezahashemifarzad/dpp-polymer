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
 *
 * 4. PPWR recycled-content targets (Phase 5 addition). The EU Packaging &
 *    Packaging Waste Regulation ((EU) 2025/40) sets *different* minimum
 *    recycled-content thresholds per packaging sub-category (single-use
 *    beverage bottles, contact-sensitive PET, contact-sensitive non-PET,
 *    and "other plastic packaging"), phased in for 2030 and 2040.
 *    PolymerPassport has no field recording which of those sub-categories
 *    a batch's end packaging falls into, so this dashboard can only
 *    compare against the one category that applies to plastic packaging
 *    generally when no more specific category is known: "other plastic
 *    packaging" — 35% by 2030, 65% by 2040 (cross-checked against three
 *    independent regulatory summaries of Article 7). This is a baseline
 *    reference point for portfolio-level planning, not a per-batch legal
 *    determination — see PPWR_OTHER_PLASTIC_PACKAGING_TARGETS' own inline
 *    citation and regulatoryCompliance.disclaimer below.
 *
 * 5. Sustainability Readiness Index (Phase 5 addition). A composite 0-100
 *    score built ENTIRELY from figures this file already computes — see
 *    computeReadinessIndex below for the exact weights and inputs. It is
 *    intentionally transparent (every component score and its weight is
 *    returned, never just the final number) rather than a black-box
 *    rating, so a viewer can see exactly what moved it.
 */

import { prisma } from "@/lib/prisma";
import { getCertificationAlertLevel } from "@/lib/utils/certification-status";

export const EU_PLASTIC_TAX_RATE_EUR_PER_TONNE = 800;

// PPWR (EU) 2025/40, Article 7 — minimum recycled content for "plastic
// packaging other than [single-use beverage bottles / contact-sensitive
// PET / contact-sensitive non-PET]," i.e. the general baseline category.
// See caveat #4 above for why this is the only PPWR sub-category this
// dashboard can meaningfully compare a batch against.
export const PPWR_OTHER_PLASTIC_PACKAGING_TARGETS: { year: number; targetPercent: number }[] = [
  { year: 2030, targetPercent: 35 },
  { year: 2040, targetPercent: 65 },
];

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

// --- Phase 5: Advanced ESG & Carbon Analytics Dashboard additions ---------

export interface EsgManufacturerDistributionPoint {
  manufacturerId: string | null; // null = passports with no manufacturer linked ("Unassigned")
  manufacturerName: string;
  country: string | null;
  batchCount: number;
  batchCountPercent: number; // % of activeBatches
  avgRecycledContentPercent: number;
  avgVerifiedCarbonIntensityKgCO2ePerKg: number | null; // null if no batch from this manufacturer has a verified figure
  totalMassKg: number; // only over this manufacturer's batches with a recorded weight — see caveat #1
}

export interface EsgGradeDistributionPoint {
  polymerType: string;
  grade: string;
  batchCount: number;
  batchCountPercent: number; // % of activeBatches
  avgRecycledContentPercent: number;
}

export interface EsgRegulatoryTarget {
  category: string;
  year: number;
  targetPercent: number;
  actualPercent: number;
  gapPercentagePoints: number; // actualPercent - targetPercent; negative = below target
  onTrack: boolean;
}

export interface EsgRegulatoryCompliance {
  disclaimer: string;
  targets: EsgRegulatoryTarget[];
}

export interface EsgReadinessComponent {
  key: string;
  label: string;
  score: number; // 0-100
  weight: number; // fraction of the overall score this component contributes; all weights sum to 1
  detail: string;
}

export interface EsgReadinessIndex {
  overallScore: number; // 0-100, weighted sum of components, rounded
  rating: "Leading" | "Advancing" | "Developing" | "Early Stage";
  components: EsgReadinessComponent[];
  methodologyNote: string;
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
  manufacturerDistribution: EsgManufacturerDistributionPoint[];
  gradeDistribution: EsgGradeDistributionPoint[];
  regulatoryCompliance: EsgRegulatoryCompliance;
  readinessIndex: EsgReadinessIndex;
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
      // Phase 5 additions — manufacturer + material grade distribution.
      polymerType: true,
      grade: true,
      manufacturerId: true,
      manufacturer: { select: { legalName: true, country: true } },
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

  // Phase 5 — manufacturer + grade distribution, accumulated in the same
  // single pass over `active` as the mass/carbon totals above rather than
  // a second full-table loop.
  const manufacturerBuckets = new Map<
    string,
    { manufacturerId: string | null; manufacturerName: string; country: string | null; count: number; recycledSum: number; carbonSum: number; carbonCount: number; massKg: number }
  >();
  const gradeBuckets = new Map<
    string,
    { polymerType: string; grade: string; count: number; recycledSum: number }
  >();

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

    // Manufacturer distribution — bucketed by manufacturerId, with a
    // dedicated "Unassigned" bucket (key "unassigned") for batches with no
    // manufacturer linked (manufacturerId is nullable — see schema.prisma)
    // rather than silently dropping them from the breakdown.
    const manufacturerKey = p.manufacturerId ?? "unassigned";
    const mBucket = manufacturerBuckets.get(manufacturerKey) ?? {
      manufacturerId: p.manufacturerId,
      manufacturerName: p.manufacturer?.legalName ?? "Unassigned",
      country: p.manufacturer?.country ?? null,
      count: 0,
      recycledSum: 0,
      carbonSum: 0,
      carbonCount: 0,
      massKg: 0,
    };
    mBucket.count++;
    mBucket.recycledSum += recycledPercent;
    if (verifiedIntensity > 0) {
      mBucket.carbonSum += verifiedIntensity;
      mBucket.carbonCount++;
    }
    if (weightKg !== null && weightKg > 0) mBucket.massKg += weightKg;
    manufacturerBuckets.set(manufacturerKey, mBucket);

    // Grade distribution — bucketed by polymerType+grade (grade is
    // free-text per schema.prisma's own comment, so two manufacturers
    // could reuse the same grade name for different polymers).
    const gradeKey = `${p.polymerType}::${p.grade}`;
    const gBucket = gradeBuckets.get(gradeKey) ?? {
      polymerType: p.polymerType,
      grade: p.grade,
      count: 0,
      recycledSum: 0,
    };
    gBucket.count++;
    gBucket.recycledSum += recycledPercent;
    gradeBuckets.set(gradeKey, gBucket);
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

  // --- Phase 5: manufacturer distribution, sorted by batch count desc ------
  const manufacturerDistribution: EsgManufacturerDistributionPoint[] = Array.from(manufacturerBuckets.values())
    .map((b) => ({
      manufacturerId: b.manufacturerId,
      manufacturerName: b.manufacturerName,
      country: b.country,
      batchCount: b.count,
      batchCountPercent: pct(b.count, activeBatches),
      avgRecycledContentPercent: round2(b.recycledSum / b.count),
      avgVerifiedCarbonIntensityKgCO2ePerKg: b.carbonCount > 0 ? round3(b.carbonSum / b.carbonCount) : null,
      totalMassKg: round2(b.massKg),
    }))
    .sort((a, b) => b.batchCount - a.batchCount);

  // --- Phase 5: material grade distribution, sorted by batch count desc ----
  const gradeDistribution: EsgGradeDistributionPoint[] = Array.from(gradeBuckets.values())
    .map((b) => ({
      polymerType: b.polymerType,
      grade: b.grade,
      batchCount: b.count,
      batchCountPercent: pct(b.count, activeBatches),
      avgRecycledContentPercent: round2(b.recycledSum / b.count),
    }))
    .sort((a, b) => b.batchCount - a.batchCount);

  // --- Phase 5: PPWR regulatory target comparison ---------------------------
  // Compared against pcrMass.pcrAdoptionRatePercent (mass-weighted
  // Post-Consumer Recycled content over weighed batches) — the figure this
  // file already computes that most directly matches what PPWR's recycled
  // content requirement measures. See the file banner's caveat #4 for why
  // only the "other plastic packaging" baseline category applies here.
  const regulatoryCompliance: EsgRegulatoryCompliance = {
    disclaimer:
      "Compared against the EU PPWR (2025/40) 'other plastic packaging' baseline recycled-content target — " +
      "the only PPWR sub-category this dashboard can compare against, since PolymerPassport does not record " +
      "which packaging sub-category (single-use beverage bottle, contact-sensitive PET/non-PET) a batch's end " +
      "packaging falls into. Actual applicable target may be higher or lower depending on end-use packaging " +
      "classification — consult a qualified regulatory advisor before using this as a compliance determination.",
    targets: PPWR_OTHER_PLASTIC_PACKAGING_TARGETS.map((t) => {
      const actual = pcrMass.pcrAdoptionRatePercent;
      const gap = round2(actual - t.targetPercent);
      return {
        category: "Other Plastic Packaging (PPWR baseline)",
        year: t.year,
        targetPercent: t.targetPercent,
        actualPercent: actual,
        gapPercentagePoints: gap,
        onTrack: gap >= 0,
      };
    }),
  };

  // --- Phase 5: Sustainability Readiness Index -------------------------------
  const readinessIndex = computeReadinessIndex({
    totalBatches,
    pcrAdoptionRatePercent: pcrMass.pcrAdoptionRatePercent,
    certVerifiedPercent: compliance.verifiedPercent,
    thirdPartyVerifiedPercent: carbon.thirdPartyVerifiedPercent,
    verifiedCertsValid: compliance.verifiedCurrentlyValid,
    verifiedCertsTotal: compliance.verified,
    batchesWithWeightData,
    batchesConsidered: activeBatches,
  });

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
    manufacturerDistribution,
    gradeDistribution,
    regulatoryCompliance,
    readinessIndex,
  };
}

/**
 * Weighted composite of five already-computed portfolio figures — every
 * input is a metric this file returns elsewhere too, so the index can
 * never show a component score that disagrees with the KPI it's derived
 * from. Weights are fixed constants (not configurable via UI/API), chosen
 * to emphasize the two hardest-to-fake signals (PPWR target progress,
 * third-party-verified LCA rate) without letting any single component
 * dominate. Returned in full (score + weight + detail per component) so
 * the dashboard never presents just a bare number.
 */
function computeReadinessIndex(input: {
  totalBatches: number;
  pcrAdoptionRatePercent: number;
  certVerifiedPercent: number;
  thirdPartyVerifiedPercent: number;
  verifiedCertsValid: number;
  verifiedCertsTotal: number;
  batchesWithWeightData: number;
  batchesConsidered: number;
}): EsgReadinessIndex {
  const ppwr2030Target = PPWR_OTHER_PLASTIC_PACKAGING_TARGETS[0].targetPercent;
  const certCurrencyPercent = pct(input.verifiedCertsValid, input.verifiedCertsTotal);
  const dataCompletenessPercent = pct(input.batchesWithWeightData, input.batchesConsidered);

  const components: EsgReadinessComponent[] = [
    {
      key: "ppwrProgress",
      label: "PPWR 2030 Recycled-Content Progress",
      score: clamp0to100(round2((input.pcrAdoptionRatePercent / ppwr2030Target) * 100)),
      weight: 0.3,
      detail: `${input.pcrAdoptionRatePercent}% mass-weighted PCR adoption vs. the ${ppwr2030Target}% PPWR 2030 baseline target`,
    },
    {
      key: "certVerification",
      label: "Certification Verification Rate",
      score: clamp0to100(input.certVerifiedPercent),
      weight: 0.2,
      detail: `${input.certVerifiedPercent}% of submitted certifications are VERIFIED`,
    },
    {
      key: "thirdPartyLca",
      label: "Third-Party LCA Verification Rate",
      score: clamp0to100(input.thirdPartyVerifiedPercent),
      weight: 0.2,
      detail: `${input.thirdPartyVerifiedPercent}% of batches with a verified carbon figure have third-party-verified LCA`,
    },
    {
      key: "certCurrency",
      label: "Compliance Currency (Verified Certs Not Expired)",
      score: clamp0to100(certCurrencyPercent),
      weight: 0.15,
      detail: `${input.verifiedCertsValid} of ${input.verifiedCertsTotal} verified certifications are currently valid (not expired/expiring)`,
    },
    {
      key: "dataCompleteness",
      label: "Batch Mass-Data Completeness",
      score: clamp0to100(dataCompletenessPercent),
      weight: 0.15,
      detail: `${input.batchesWithWeightData} of ${input.batchesConsidered} active batches have a recorded weight, enabling mass-based ESG metrics`,
    },
  ];

  const overallScore = input.totalBatches > 0
    ? round2(components.reduce((sum, c) => sum + c.score * c.weight, 0))
    : 0;

  const rating: EsgReadinessIndex["rating"] =
    input.totalBatches === 0
      ? "Early Stage"
      : overallScore >= 85
        ? "Leading"
        : overallScore >= 65
          ? "Advancing"
          : overallScore >= 40
            ? "Developing"
            : "Early Stage";

  return {
    overallScore,
    rating,
    components,
    methodologyNote:
      "Weighted average of 5 components (weights shown per component, sum to 100%): PPWR 2030 recycled-content " +
      "progress (30%), certification verification rate (20%), third-party LCA verification rate (20%), " +
      "compliance currency (15%), and batch mass-data completeness (15%). Each component is capped at 100 even " +
      "when a figure exceeds its reference target. Computed fresh on every request from the same ledger figures " +
      "shown elsewhere on this dashboard — never a stored or cached score.",
  };
}

function clamp0to100(n: number): number {
  return Math.max(0, Math.min(100, n));
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
