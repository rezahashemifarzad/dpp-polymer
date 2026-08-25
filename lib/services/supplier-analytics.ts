/**
 * lib/services/supplier-analytics.ts
 * -----------------------------------------------------------------------
 * Phase 7 - Step 2: Supplier Performance & Compliance Ranking Dashboard.
 *
 * Read-only aggregation over every PolymerPassport, bucketed by its
 * Manufacturer (manufacturerId) — the same "supplier == Manufacturer"
 * scoping esg-analytics.ts's own manufacturerDistribution already
 * established (see that file's comment on the same bucket). This file is
 * NEW rather than an edit to esg-analytics.ts because it computes a
 * materially different thing: that file reports one flat batch/PCR/carbon
 * breakdown *per manufacturer* for a portfolio-wide sustainability report;
 * this file additionally derives a weighted, transparent 0-100
 * *performance score* per supplier from certification compliance,
 * certificate currency, recycled-content adoption, and carbon-reporting
 * completeness, then ranks suppliers by it — a genuinely different
 * question ("who is my best/worst supplier right now") from "what does my
 * whole portfolio look like."
 *
 * "Compute, don't store" — same principle as every other analytics file in
 * this app (esg-analytics.ts, plastic-tax-calculator.ts,
 * lib/utils/certification-status.ts): every figure here, including the
 * ranking itself, is computed fresh on every call from the live ledger.
 * There is no SupplierScore table and no cached rank column anywhere —
 * a supplier's rank can never silently go stale.
 *
 * SCOPE NOTE — what counts as "a supplier" here. This app models the
 * upstream supply chain two different ways (see schema.prisma):
 *   1. Manufacturer — a first-class entity every PolymerPassport
 *      optionally links to via manufacturerId. This is what this file
 *      ranks.
 *   2. ChainOfCustodyRecord.participantName — free text, deliberately NOT
 *      a full system entity ("onboarding every raw-material supplier... is
 *      out of scope for this MVP," per that model's own schema comment).
 * A chain-of-custody tier record therefore has no stable identity to rank
 * against and is intentionally excluded from this dashboard — including
 * it would mean grouping by a free-text string that different tiers could
 * spell differently for the same real organization, producing a
 * misleading ranking rather than an honest one.
 *
 * METRIC NOTE — recycled content. This file uses
 * PolymerPassport.totalRecycledPercent (not recycledContentPercent) for
 * each supplier's "PCR ratio," matching how the rest of the app already
 * labels that exact field as "PCR" (see app/page.tsx's dashboard tab and
 * lib/services/passport-monthly-trend.ts's avgPcr) — esg-analytics.ts's
 * own manufacturerDistribution uses recycledContentPercent instead for a
 * source-specific breakdown, a deliberate difference between those two
 * reports, not an inconsistency to "fix." At the current schema level the
 * two fields hold the same value (lib/types.ts's computeTotalRecycledPercent
 * is presently a pass-through), so today's numbers agree either way; using
 * totalRecycledPercent here simply keeps this file's terminology aligned
 * with the field the rest of the app already calls "PCR."
 */

import { prisma } from "@/lib/prisma";
import { getExpiryAlertTier } from "@/lib/utils/certification-status";
import { PPWR_OTHER_PLASTIC_PACKAGING_TARGETS } from "@/lib/services/esg-analytics";

// A REVOKED passport's claims are withdrawn and a SUPERSEDED one has been
// replaced — same reasoning, and the same two values, as esg-analytics.ts's
// own (unexported) EXCLUDED_STATUSES. Duplicated here rather than imported
// since esg-analytics.ts doesn't export it; both files independently state
// the same two-line rule for the same reason, which is easier to audit than
// a shared import would be to trace.
const EXCLUDED_STATUSES = new Set(["REVOKED", "SUPERSEDED"]);

export type SupplierTier = "Preferred" | "Approved" | "Watch" | "At Risk";

export interface SupplierScoreComponent {
  key: string;
  label: string;
  score: number; // 0-100
  weight: number; // fraction of performanceScore this component contributes; all weights sum to 1
  detail: string;
}

export interface SupplierCertificateBreakdown {
  total: number;
  verified: number;
  pendingReview: number;
  rejected: number;
  // Expiry tiers computed over ALL certifications regardless of
  // verificationStatus — same "an admin needs to know regardless of
  // status" reasoning as lib/utils/certification-status.ts's own
  // getPassportCertificationAlert.
  expired: number;
  expiringUrgent: number;
  expiringSoon: number;
}

export interface SupplierScorecard {
  manufacturerId: string;
  manufacturerName: string;
  country: string | null;
  vatNumber: string | null;

  totalBatchCount: number; // every batch ever linked, any status
  activeBatchCount: number; // excludes REVOKED/SUPERSEDED — every metric below is computed over this set
  statusBreakdown: Record<string, number>;

  avgRecycledContentPercent: number; // mean of totalRecycledPercent over active batches — see file banner's METRIC NOTE
  avgBioBasedPercent: number;
  avgCarbonFootprintKgCO2ePerKg: number | null; // mean over active batches with a verified (>0) figure; null if none
  batchesWithCarbonFigure: number;

  certificates: SupplierCertificateBreakdown;
  complianceRatePercent: number; // verified certs / total certs, over active batches' certifications
  certCurrencyRatePercent: number; // verified certs NOT expired / verified certs total

  // null (not 0) when activeBatchCount === 0 — a supplier whose batches
  // are all revoked/superseded has no *current* performance to score, and
  // scoring it 0 would misrepresent "no current activity" as "actively
  // non-compliant." See tier's own "Insufficient Data" value below.
  performanceScore: number | null;
  performanceComponents: SupplierScoreComponent[];
  tier: SupplierTier | "Insufficient Data";
  rank: number | null; // 1-based among ranked (scored) suppliers only, by performanceScore desc; null for Insufficient Data rows
}

export interface SupplierAnalyticsSummary {
  generatedAt: string; // ISO timestamp — a point-in-time snapshot, never stored
  totalSuppliers: number; // distinct Manufacturer rows with >=1 linked batch
  rankedSupplierCount: number; // of those, how many have activeBatchCount > 0 and therefore a performanceScore
  unassignedBatchCount: number; // batches with no manufacturerId at all — reported, never silently dropped
  totalBatches: number;
  portfolioAvgRecycledContentPercent: number; // over active, manufacturer-linked batches only
  portfolioAvgCarbonFootprintKgCO2ePerKg: number | null;
  tierCounts: Record<SupplierTier, number>;
  expiringCertificatesTotal: number; // expired + expiringUrgent + expiringSoon, summed across every ranked supplier
  suppliers: SupplierScorecard[]; // ranked suppliers first (performanceScore desc), then Insufficient Data suppliers by name
}

const PPWR_2030_TARGET_PERCENT = PPWR_OTHER_PLASTIC_PACKAGING_TARGETS[0].targetPercent;

export async function getSupplierAnalytics(): Promise<SupplierAnalyticsSummary> {
  // Narrow `select`, same reasoning as esg-analytics.ts — this table can
  // grow into the thousands and every field below is actually used.
  const passports = await prisma.polymerPassport.findMany({
    select: {
      status: true,
      manufacturerId: true,
      manufacturer: { select: { legalName: true, country: true, vatNumber: true } },
      totalRecycledPercent: true,
      bioBasedPercent: true,
      carbonFootprintKgCO2ePerKg: true,
      certifications: {
        select: { verificationStatus: true, validUntil: true },
      },
    },
  });

  const totalBatches = passports.length;
  let unassignedBatchCount = 0;

  interface Bucket {
    manufacturerId: string;
    manufacturerName: string;
    country: string | null;
    vatNumber: string | null;
    totalBatchCount: number;
    activeBatchCount: number;
    statusBreakdown: Record<string, number>;
    recycledSum: number;
    bioSum: number;
    carbonSum: number;
    carbonCount: number;
    certs: Array<{ verificationStatus: string; validUntil: Date }>;
  }

  const buckets = new Map<string, Bucket>();

  for (const p of passports) {
    if (!p.manufacturerId) {
      unassignedBatchCount++;
      continue;
    }

    // Explicitly typed as Bucket (not left to inference through `??`) so
    // the empty statusBreakdown/certs literals below are checked against
    // Bucket's own Record<string, number> / typed-array field types up
    // front, rather than each independently inferring a narrower type
    // (e.g. `{}` / `never[]`) that the mutations further down would then
    // fail against.
    const bucket: Bucket = buckets.get(p.manufacturerId) ?? {
      manufacturerId: p.manufacturerId,
      manufacturerName: p.manufacturer?.legalName ?? "Unknown Supplier",
      country: p.manufacturer?.country ?? null,
      vatNumber: p.manufacturer?.vatNumber ?? null,
      totalBatchCount: 0,
      activeBatchCount: 0,
      statusBreakdown: {},
      recycledSum: 0,
      bioSum: 0,
      carbonSum: 0,
      carbonCount: 0,
      certs: [],
    };

    bucket.totalBatchCount++;
    bucket.statusBreakdown[p.status] = (bucket.statusBreakdown[p.status] ?? 0) + 1;

    if (!EXCLUDED_STATUSES.has(p.status)) {
      bucket.activeBatchCount++;
      bucket.recycledSum += Number(p.totalRecycledPercent);
      bucket.bioSum += Number(p.bioBasedPercent);

      const intensity = Number(p.carbonFootprintKgCO2ePerKg);
      if (intensity > 0) {
        bucket.carbonSum += intensity;
        bucket.carbonCount++;
      }

      for (const c of p.certifications) {
        bucket.certs.push({ verificationStatus: c.verificationStatus, validUntil: c.validUntil });
      }
    }

    buckets.set(p.manufacturerId, bucket);
  }

  const suppliers: SupplierScorecard[] = Array.from(buckets.values()).map((b) => {
    let verified = 0;
    let pendingReview = 0;
    let rejected = 0;
    let expired = 0;
    let expiringUrgent = 0;
    let expiringSoon = 0;
    let verifiedNotExpired = 0;

    for (const c of b.certs) {
      if (c.verificationStatus === "VERIFIED") verified++;
      else if (c.verificationStatus === "PENDING_REVIEW") pendingReview++;
      else if (c.verificationStatus === "REJECTED") rejected++;

      const tier = getExpiryAlertTier(c.validUntil);
      if (tier === "EXPIRED") expired++;
      else if (tier === "EXPIRING_URGENT") expiringUrgent++;
      else if (tier === "EXPIRING_SOON") expiringSoon++;

      if (c.verificationStatus === "VERIFIED" && tier !== "EXPIRED") verifiedNotExpired++;
    }

    const totalCerts = b.certs.length;
    const certificates: SupplierCertificateBreakdown = {
      total: totalCerts,
      verified,
      pendingReview,
      rejected,
      expired,
      expiringUrgent,
      expiringSoon,
    };

    const complianceRatePercent = pct(verified, totalCerts);
    const certCurrencyRatePercent = pct(verifiedNotExpired, verified);

    const avgRecycledContentPercent = b.activeBatchCount > 0 ? round2(b.recycledSum / b.activeBatchCount) : 0;
    const avgBioBasedPercent = b.activeBatchCount > 0 ? round2(b.bioSum / b.activeBatchCount) : 0;
    const avgCarbonFootprintKgCO2ePerKg = b.carbonCount > 0 ? round3(b.carbonSum / b.carbonCount) : null;
    const carbonReportingRatePercent = pct(b.carbonCount, b.activeBatchCount);
    const recycledAdoptionScore = clamp0to100(round2((avgRecycledContentPercent / PPWR_2030_TARGET_PERCENT) * 100));

    let performanceScore: number | null = null;
    let performanceComponents: SupplierScoreComponent[] = [];
    let tier: SupplierTier | "Insufficient Data" = "Insufficient Data";

    if (b.activeBatchCount > 0) {
      performanceComponents = [
        {
          key: "certVerification",
          label: "Certification Verification Rate",
          score: clamp0to100(complianceRatePercent),
          weight: 0.35,
          detail: `${verified} of ${totalCerts} submitted certification(s) are VERIFIED`,
        },
        {
          key: "certCurrency",
          label: "Certificate Currency (Not Expired)",
          score: clamp0to100(certCurrencyRatePercent),
          weight: 0.25,
          detail:
            verified > 0
              ? `${verifiedNotExpired} of ${verified} verified certification(s) have not yet expired`
              : "No verified certifications on file yet",
        },
        {
          key: "recycledAdoption",
          label: "Recycled Content Adoption vs. PPWR 2030",
          score: recycledAdoptionScore,
          weight: 0.25,
          detail: `${avgRecycledContentPercent}% avg. recycled content vs. the ${PPWR_2030_TARGET_PERCENT}% PPWR 2030 baseline target`,
        },
        {
          key: "carbonReporting",
          label: "Carbon Footprint Reporting Completeness",
          score: clamp0to100(carbonReportingRatePercent),
          weight: 0.15,
          detail: `${b.carbonCount} of ${b.activeBatchCount} active batch(es) have a verified carbon footprint figure on file`,
        },
      ];
      performanceScore = round2(performanceComponents.reduce((sum, c) => sum + c.score * c.weight, 0));
      tier =
        performanceScore >= 85
          ? "Preferred"
          : performanceScore >= 65
            ? "Approved"
            : performanceScore >= 40
              ? "Watch"
              : "At Risk";
    }

    return {
      manufacturerId: b.manufacturerId,
      manufacturerName: b.manufacturerName,
      country: b.country,
      vatNumber: b.vatNumber,
      totalBatchCount: b.totalBatchCount,
      activeBatchCount: b.activeBatchCount,
      statusBreakdown: b.statusBreakdown,
      avgRecycledContentPercent,
      avgBioBasedPercent,
      avgCarbonFootprintKgCO2ePerKg,
      batchesWithCarbonFigure: b.carbonCount,
      certificates,
      complianceRatePercent,
      certCurrencyRatePercent,
      performanceScore,
      performanceComponents,
      tier,
      rank: null, // assigned below, after sorting
    };
  });

  // Rank scored suppliers by performanceScore desc; Insufficient Data
  // suppliers sort after, alphabetically, so a batch of retired/inactive
  // suppliers never crowds out the live ranking at the top of the table.
  const ranked = suppliers.filter((s) => s.performanceScore !== null).sort((a, b) => (b.performanceScore! - a.performanceScore!));
  ranked.forEach((s, i) => {
    s.rank = i + 1;
  });
  const unranked = suppliers
    .filter((s) => s.performanceScore === null)
    .sort((a, b) => a.manufacturerName.localeCompare(b.manufacturerName));

  const orderedSuppliers = [...ranked, ...unranked];

  const tierCounts: Record<SupplierTier, number> = {
    Preferred: 0,
    Approved: 0,
    Watch: 0,
    "At Risk": 0,
  };
  let expiringCertificatesTotal = 0;
  let portfolioRecycledSum = 0;
  let portfolioCarbonSum = 0;
  let portfolioCarbonCount = 0;
  let portfolioActiveBatches = 0;

  for (const s of orderedSuppliers) {
    if (s.tier !== "Insufficient Data") tierCounts[s.tier]++;
    expiringCertificatesTotal += s.certificates.expired + s.certificates.expiringUrgent + s.certificates.expiringSoon;
    portfolioRecycledSum += s.avgRecycledContentPercent * s.activeBatchCount;
    if (s.avgCarbonFootprintKgCO2ePerKg !== null) {
      portfolioCarbonSum += s.avgCarbonFootprintKgCO2ePerKg * s.batchesWithCarbonFigure;
      portfolioCarbonCount += s.batchesWithCarbonFigure;
    }
    portfolioActiveBatches += s.activeBatchCount;
  }

  return {
    generatedAt: new Date().toISOString(),
    totalSuppliers: orderedSuppliers.length,
    rankedSupplierCount: ranked.length,
    unassignedBatchCount,
    totalBatches,
    portfolioAvgRecycledContentPercent: portfolioActiveBatches > 0 ? round2(portfolioRecycledSum / portfolioActiveBatches) : 0,
    portfolioAvgCarbonFootprintKgCO2ePerKg: portfolioCarbonCount > 0 ? round3(portfolioCarbonSum / portfolioCarbonCount) : null,
    tierCounts,
    expiringCertificatesTotal,
    suppliers: orderedSuppliers,
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
