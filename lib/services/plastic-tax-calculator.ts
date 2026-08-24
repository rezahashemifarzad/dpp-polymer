/**
 * lib/services/plastic-tax-calculator.ts
 * -----------------------------------------------------------------------
 * Green Accounting & EU Plastic Tax Tracker — calculation engine.
 *
 * Computes plastic-tax financial figures (gross liability, PCR-based tax
 * savings, net liability) across the active material ledger, and persists
 * an optional locked snapshot per batch (BatchGreenValuation) when a user
 * explicitly requests one. Everything else is computed fresh on every
 * call — same "compute, don't store" principle as
 * lib/services/esg-analytics.ts, whose EU_PLASTIC_TAX_RATE_EUR_PER_TONNE
 * constant and illustrative-estimate disclaimer this file deliberately
 * mirrors rather than replaces (that file's own tax-relief KPI is
 * untouched and continues to power the existing ESG dashboard card; this
 * is a separate, more detailed feature reachable from a dedicated page
 * and a new widget alongside it).
 *
 * IMPORTANT CAVEATS (same standing caveats as esg-analytics.ts, repeated
 * here because this file is the one place a figure can be LOCKED into a
 * persisted BatchGreenValuation row):
 *
 * 1. Batch mass. Same limitation as esg-analytics.ts caveat #1 — batch
 *    weight only exists via the optional CarbonFootprintCalculation.
 *    weightKg. A batch with no recorded weight cannot be valued; callers
 *    must check `hasWeightData` before treating a batch's figures as
 *    real.
 * 2. This is an ILLUSTRATIVE planning estimate, NOT tax or legal advice.
 *    See DISCLAIMER below — carried into every summary this file returns
 *    and into the persisted BatchGreenValuation snapshot's own
 *    presentation layer.
 * 3. PCR mass only. Mirrors esg-analytics.ts: only recycledContentSource
 *    === "POST_CONSUMER" mass counts toward the tax-savings calculation,
 *    matching how the real levy mechanism rewards recycled content
 *    specifically (Post-Industrial Recycled content is not counted here).
 */

import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

// Fallback used only when no PlasticTaxParameter row exists yet for the
// requested jurisdiction — lets the feature work immediately without
// requiring an admin to seed a parameter first. Mirrors esg-analytics.ts's
// own EU_PLASTIC_TAX_RATE_EUR_PER_TONNE = 800 figure; kept as a distinct
// constant (not imported) so this file has no compile-time dependency on
// esg-analytics.ts's internals, and so esg-analytics.ts's own KPI can
// never be affected by anything in this file.
export const DEFAULT_TAX_RATE_EUR_PER_TONNE = 800;
export const DEFAULT_JURISDICTION = "EU";

export const GREEN_ACCOUNTING_DISCLAIMER =
  "Illustrative estimate only, not tax or legal advice. Based on the configured rate per tonne applied to " +
  "Post-Consumer Recycled mass across batches with a recorded weight. Actual liability depends on " +
  "jurisdiction, product category, and national implementation — consult a qualified tax advisor before " +
  "relying on these figures beyond internal planning.";

// Mirrors esg-analytics.ts's own EXCLUDED_STATUSES: a REVOKED passport's
// claims are withdrawn and a SUPERSEDED one has been replaced, so neither
// belongs in a live financial total. Kept as a local copy (not imported)
// for the same file-independence reason as the rate constant above.
const EXCLUDED_STATUSES = new Set(["REVOKED", "SUPERSEDED"]);

export interface ActiveTaxParameter {
  id: string | null; // null when using the built-in fallback, never persisted
  jurisdiction: string;
  label: string;
  currency: string;
  ratePerTonne: number;
  isFallback: boolean;
}

export interface TaxParameterSummary {
  id: string;
  jurisdiction: string;
  label: string;
  currency: string;
  ratePerTonne: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  active: boolean;
  source: string | null;
  notes: string | null;
}

export interface BatchGreenAccountingResult {
  batchId: string;
  hasWeightData: boolean;
  batchMassKg: number;
  pcrMassKg: number;
  taxableMassKg: number;
  ratePerTonneEur: number;
  grossLiabilityEur: number;
  pcrTaxSavingsEur: number;
  netLiabilityEur: number;
  jurisdiction: string;
  taxParameterId: string | null;
  taxParameterLabel: string;
  disclaimer: string;
}

export interface GreenAccountingBatchRow {
  batchId: string;
  polymerType: string;
  grade: string;
  manufacturerName: string | null;
  status: string;
  hasWeightData: boolean;
  batchMassKg: number;
  pcrMassKg: number;
  taxableMassKg: number;
  grossLiabilityEur: number;
  pcrTaxSavingsEur: number;
  netLiabilityEur: number;
  hasLockedValuation: boolean;
}

export interface PortfolioGreenAccountingSummary {
  generatedAt: string;
  jurisdiction: string;
  ratePerTonneEur: number;
  taxParameterId: string | null;
  taxParameterLabel: string;
  totalBatches: number;
  activeBatches: number;
  excludedBatches: number;
  batchesWithWeightData: number;
  batchesMissingWeightData: number;
  totalMassKg: number;
  totalPcrMassKg: number;
  totalTaxableMassKg: number;
  totalGrossLiabilityEur: number;
  totalPcrTaxSavingsEur: number;
  totalNetLiabilityEur: number;
  disclaimer: string;
  batches: GreenAccountingBatchRow[];
}

/**
 * Resolves the currently-active tax parameter for a jurisdiction: the row
 * with the latest effectiveFrom among active=true rows whose window covers
 * now. Falls back to DEFAULT_TAX_RATE_EUR_PER_TONNE (not persisted) when
 * none exists yet, so the feature is usable before any admin configuration.
 */
export async function getActiveTaxParameter(
  jurisdiction: string = DEFAULT_JURISDICTION
): Promise<ActiveTaxParameter> {
  const now = new Date();
  const row = await prisma.plasticTaxParameter.findFirst({
    where: {
      jurisdiction,
      active: true,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!row) {
    return {
      id: null,
      jurisdiction,
      label: "EU Plastic Packaging Tax (default)",
      currency: "EUR",
      ratePerTonne: DEFAULT_TAX_RATE_EUR_PER_TONNE,
      isFallback: true,
    };
  }

  return {
    id: row.id,
    jurisdiction: row.jurisdiction,
    label: row.label,
    currency: row.currency,
    ratePerTonne: Number(row.ratePerTonne),
    isFallback: false,
  };
}

export async function listTaxParameters(jurisdiction?: string): Promise<TaxParameterSummary[]> {
  const rows = await prisma.plasticTaxParameter.findMany({
    where: jurisdiction ? { jurisdiction } : undefined,
    orderBy: [{ jurisdiction: "asc" }, { effectiveFrom: "desc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    jurisdiction: row.jurisdiction,
    label: row.label,
    currency: row.currency,
    ratePerTonne: Number(row.ratePerTonne),
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: row.effectiveTo ? row.effectiveTo.toISOString() : null,
    active: row.active,
    source: row.source,
    notes: row.notes,
  }));
}

export interface CreateTaxParameterInput {
  jurisdiction?: string;
  label?: string;
  currency?: string;
  ratePerTonne: number;
  source?: string;
  notes?: string;
}

/**
 * Creates a new tax parameter and retires any currently-active row for the
 * same jurisdiction (active=false, effectiveTo=now) — a simple version
 * history rather than an in-place edit, so a locked BatchGreenValuation's
 * ratePerTonneEurSnapshot always still traces back to the exact parameter
 * row that was active when it was saved.
 */
export async function createTaxParameter(input: CreateTaxParameterInput): Promise<TaxParameterSummary> {
  if (!Number.isFinite(input.ratePerTonne) || input.ratePerTonne < 0) {
    throw new Error("ratePerTonne must be a non-negative number");
  }
  const jurisdiction = input.jurisdiction?.trim() || DEFAULT_JURISDICTION;
  const now = new Date();

  const created = await prisma.$transaction(async (tx) => {
    await tx.plasticTaxParameter.updateMany({
      where: { jurisdiction, active: true },
      data: { active: false, effectiveTo: now },
    });

    return tx.plasticTaxParameter.create({
      data: {
        jurisdiction,
        label: input.label?.trim() || "EU Plastic Packaging Tax",
        currency: input.currency?.trim() || "EUR",
        ratePerTonne: input.ratePerTonne,
        effectiveFrom: now,
        active: true,
        source: input.source?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    });
  });

  return {
    id: created.id,
    jurisdiction: created.jurisdiction,
    label: created.label,
    currency: created.currency,
    ratePerTonne: Number(created.ratePerTonne),
    effectiveFrom: created.effectiveFrom.toISOString(),
    effectiveTo: created.effectiveTo ? created.effectiveTo.toISOString() : null,
    active: created.active,
    source: created.source,
    notes: created.notes,
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Shared mass-figure logic — mirrors esg-analytics.ts's own PCR-mass loop.
 * Exported so lib/services/green-tax-trend-forecast.ts (Sprint 3.3) can
 * reuse the exact same PCR-mass business rule when bucketing historical
 * batches by production quarter, rather than re-deriving it.
 */
export function deriveMassFigures(
  weightKg: number | null,
  recycledContentSource: string | null,
  recycledContentPercent: number
): { hasWeightData: boolean; batchMassKg: number; pcrMassKg: number } {
  if (weightKg === null || weightKg <= 0) {
    return { hasWeightData: false, batchMassKg: 0, pcrMassKg: 0 };
  }
  const pcrMassKg = recycledContentSource === "POST_CONSUMER" ? weightKg * (recycledContentPercent / 100) : 0;
  return { hasWeightData: true, batchMassKg: weightKg, pcrMassKg };
}

/** Exported for the same reason as deriveMassFigures above. */
export function computeLiability(batchMassKg: number, pcrMassKg: number, ratePerTonneEur: number) {
  const taxableMassKg = Math.max(0, batchMassKg - pcrMassKg);
  const grossLiabilityEur = round2((batchMassKg / 1000) * ratePerTonneEur);
  const pcrTaxSavingsEur = round2((pcrMassKg / 1000) * ratePerTonneEur);
  const netLiabilityEur = round2((taxableMassKg / 1000) * ratePerTonneEur);
  return { taxableMassKg: round3(taxableMassKg), grossLiabilityEur, pcrTaxSavingsEur, netLiabilityEur };
}

/** Live (never persisted) figures for a single batch. */
export async function computeBatchGreenAccounting(
  batchId: string,
  jurisdiction: string = DEFAULT_JURISDICTION
): Promise<BatchGreenAccountingResult | null> {
  const passport = await prisma.polymerPassport.findUnique({
    where: { batchId },
    select: {
      id: true,
      batchId: true,
      recycledContentSource: true,
      recycledContentPercent: true,
      carbonFootprintCalculation: { select: { weightKg: true } },
    },
  });
  if (!passport) return null;

  const taxParam = await getActiveTaxParameter(jurisdiction);
  const weightKg = passport.carbonFootprintCalculation ? Number(passport.carbonFootprintCalculation.weightKg) : null;
  const { hasWeightData, batchMassKg, pcrMassKg } = deriveMassFigures(
    weightKg,
    passport.recycledContentSource,
    Number(passport.recycledContentPercent)
  );
  const { taxableMassKg, grossLiabilityEur, pcrTaxSavingsEur, netLiabilityEur } = computeLiability(
    batchMassKg,
    pcrMassKg,
    taxParam.ratePerTonne
  );

  return {
    batchId: passport.batchId,
    hasWeightData,
    batchMassKg: round3(batchMassKg),
    pcrMassKg: round3(pcrMassKg),
    taxableMassKg,
    ratePerTonneEur: taxParam.ratePerTonne,
    grossLiabilityEur,
    pcrTaxSavingsEur,
    netLiabilityEur,
    jurisdiction: taxParam.jurisdiction,
    taxParameterId: taxParam.id,
    taxParameterLabel: taxParam.label,
    disclaimer: GREEN_ACCOUNTING_DISCLAIMER,
  };
}

/** Live (never persisted) portfolio totals + per-batch breakdown. */
export async function computePortfolioGreenAccounting(
  jurisdiction: string = DEFAULT_JURISDICTION
): Promise<PortfolioGreenAccountingSummary> {
  const taxParam = await getActiveTaxParameter(jurisdiction);

  const passports = await prisma.polymerPassport.findMany({
    select: {
      batchId: true,
      polymerType: true,
      grade: true,
      status: true,
      recycledContentSource: true,
      recycledContentPercent: true,
      manufacturer: { select: { legalName: true } },
      carbonFootprintCalculation: { select: { weightKg: true } },
      greenValuation: { select: { id: true } },
    },
  });

  const totalBatches = passports.length;
  const active = passports.filter((p) => !EXCLUDED_STATUSES.has(p.status));
  const activeBatches = active.length;

  let batchesWithWeightData = 0;
  let totalMassKg = 0;
  let totalPcrMassKg = 0;
  let totalTaxableMassKg = 0;
  let totalGrossLiabilityEur = 0;
  let totalPcrTaxSavingsEur = 0;
  let totalNetLiabilityEur = 0;

  const batches: GreenAccountingBatchRow[] = active.map((p) => {
    const weightKg = p.carbonFootprintCalculation ? Number(p.carbonFootprintCalculation.weightKg) : null;
    const { hasWeightData, batchMassKg, pcrMassKg } = deriveMassFigures(
      weightKg,
      p.recycledContentSource,
      Number(p.recycledContentPercent)
    );
    const { taxableMassKg, grossLiabilityEur, pcrTaxSavingsEur, netLiabilityEur } = computeLiability(
      batchMassKg,
      pcrMassKg,
      taxParam.ratePerTonne
    );

    if (hasWeightData) {
      batchesWithWeightData++;
      totalMassKg += batchMassKg;
      totalPcrMassKg += pcrMassKg;
      totalTaxableMassKg += taxableMassKg;
      totalGrossLiabilityEur += grossLiabilityEur;
      totalPcrTaxSavingsEur += pcrTaxSavingsEur;
      totalNetLiabilityEur += netLiabilityEur;
    }

    return {
      batchId: p.batchId,
      polymerType: p.polymerType,
      grade: p.grade,
      manufacturerName: p.manufacturer?.legalName ?? null,
      status: p.status,
      hasWeightData,
      batchMassKg: round3(batchMassKg),
      pcrMassKg: round3(pcrMassKg),
      taxableMassKg,
      grossLiabilityEur,
      pcrTaxSavingsEur,
      netLiabilityEur,
      hasLockedValuation: p.greenValuation !== null,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    jurisdiction: taxParam.jurisdiction,
    ratePerTonneEur: taxParam.ratePerTonne,
    taxParameterId: taxParam.id,
    taxParameterLabel: taxParam.label,
    totalBatches,
    activeBatches,
    excludedBatches: totalBatches - activeBatches,
    batchesWithWeightData,
    batchesMissingWeightData: activeBatches - batchesWithWeightData,
    totalMassKg: round2(totalMassKg),
    totalPcrMassKg: round2(totalPcrMassKg),
    totalTaxableMassKg: round2(totalTaxableMassKg),
    totalGrossLiabilityEur: round2(totalGrossLiabilityEur),
    totalPcrTaxSavingsEur: round2(totalPcrTaxSavingsEur),
    totalNetLiabilityEur: round2(totalNetLiabilityEur),
    disclaimer: GREEN_ACCOUNTING_DISCLAIMER,
    batches,
  };
}

export type SaveBatchGreenValuationResult =
  | { ok: true; status: 200; data: BatchGreenAccountingResult }
  | { ok: false; status: 400; error: string }
  | { ok: false; status: 404; error: string };

/**
 * Locks the current live figures for a batch into a persisted
 * BatchGreenValuation snapshot — upserted on passportId ("latest only"),
 * mirroring calculateAndPersistCarbonFootprint's own upsert pattern.
 * Requires the batch to have recorded weight data (a locked valuation with
 * no real mass behind it would be misleading), unlike the live
 * compute*GreenAccounting functions above which surface hasWeightData:
 * false gracefully instead of erroring.
 */
export async function saveBatchGreenValuation(
  batchId: string,
  actor: string,
  jurisdiction: string = DEFAULT_JURISDICTION
): Promise<SaveBatchGreenValuationResult> {
  const passport = await prisma.polymerPassport.findUnique({
    where: { batchId },
    select: {
      id: true,
      batchId: true,
      recycledContentSource: true,
      recycledContentPercent: true,
      carbonFootprintCalculation: { select: { weightKg: true } },
    },
  });
  if (!passport) {
    return { ok: false, status: 404, error: `No passport found for batchId "${batchId}"` };
  }

  const taxParam = await getActiveTaxParameter(jurisdiction);
  const weightKg = passport.carbonFootprintCalculation ? Number(passport.carbonFootprintCalculation.weightKg) : null;
  const { hasWeightData, batchMassKg, pcrMassKg } = deriveMassFigures(
    weightKg,
    passport.recycledContentSource,
    Number(passport.recycledContentPercent)
  );
  if (!hasWeightData) {
    return {
      ok: false,
      status: 400,
      error:
        "This batch has no recorded weight yet — run the Carbon Footprint calculator for this batch first, then save a green valuation.",
    };
  }

  const { taxableMassKg, grossLiabilityEur, pcrTaxSavingsEur, netLiabilityEur } = computeLiability(
    batchMassKg,
    pcrMassKg,
    taxParam.ratePerTonne
  );

  // A locked valuation must reference a real, persisted PlasticTaxParameter
  // row (the relation is required) — if only the built-in fallback rate is
  // in play, materialize it as the jurisdiction's first parameter row so
  // the snapshot has something concrete to point to.
  let taxParameterId = taxParam.id;
  if (!taxParameterId) {
    const materialized = await createTaxParameter({
      jurisdiction: taxParam.jurisdiction,
      label: taxParam.label,
      currency: taxParam.currency,
      ratePerTonne: taxParam.ratePerTonne,
      source: "Auto-created from built-in default on first Green Accounting save.",
    });
    taxParameterId = materialized.id;
  }

  const saved = await prisma.$transaction(async (tx) => {
    const record = await tx.batchGreenValuation.upsert({
      where: { passportId: passport.id },
      create: {
        passportId: passport.id,
        taxParameterId: taxParameterId as string,
        batchMassKg,
        pcrMassKg,
        taxableMassKg,
        ratePerTonneEurSnapshot: taxParam.ratePerTonne,
        grossLiabilityEur,
        pcrTaxSavingsEur,
        netLiabilityEur,
        valuedAt: new Date(),
        valuedBy: actor,
      },
      update: {
        taxParameterId: taxParameterId as string,
        batchMassKg,
        pcrMassKg,
        taxableMassKg,
        ratePerTonneEurSnapshot: taxParam.ratePerTonne,
        grossLiabilityEur,
        pcrTaxSavingsEur,
        netLiabilityEur,
        valuedAt: new Date(),
        valuedBy: actor,
      },
    });

    await writeAuditLog(tx, {
      passportId: passport.id,
      action: "GREEN_VALUATION_SAVED",
      actor,
      previousHash: null,
      newHash: null,
      metadata: {
        netLiabilityEur,
        pcrTaxSavingsEur,
        ratePerTonneEur: taxParam.ratePerTonne,
      },
    });

    return record;
  });

  return {
    ok: true,
    status: 200,
    data: {
      batchId: passport.batchId,
      hasWeightData: true,
      batchMassKg: round3(Number(saved.batchMassKg)),
      pcrMassKg: round3(Number(saved.pcrMassKg)),
      taxableMassKg: round3(Number(saved.taxableMassKg)),
      ratePerTonneEur: Number(saved.ratePerTonneEurSnapshot),
      grossLiabilityEur: Number(saved.grossLiabilityEur),
      pcrTaxSavingsEur: Number(saved.pcrTaxSavingsEur),
      netLiabilityEur: Number(saved.netLiabilityEur),
      jurisdiction: taxParam.jurisdiction,
      taxParameterId,
      taxParameterLabel: taxParam.label,
      disclaimer: GREEN_ACCOUNTING_DISCLAIMER,
    },
  };
}
