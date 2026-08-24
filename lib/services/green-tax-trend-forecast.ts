/**
 * lib/services/green-tax-trend-forecast.ts
 * -----------------------------------------------------------------------
 * Sprint 3.3 (Green Tax Trends & Forecasting Module) — aggregates
 * historical batch valuations, bucketed by production quarter, against
 * the tax parameter rate that was actually effective at each batch's
 * production date (see PlasticTaxParameter's effectiveFrom/effectiveTo
 * versioning in lib/services/plastic-tax-calculator.ts), then projects a
 * simple forward trend for the next four quarters (~12 months).
 *
 * "Compute, don't store" — same principle as every other analytics
 * service in this app (esg-analytics.ts, plastic-tax-calculator.ts):
 * nothing here is persisted, so there is no cached trend figure to ever
 * drift from the underlying ledger.
 *
 * Reuses plastic-tax-calculator.ts's deriveMassFigures/computeLiability
 * (exported for exactly this reason) so a batch's mass/liability figures
 * here can never disagree with the live per-batch figures on
 * /admin/green-accounting for the same batch.
 *
 * METHODOLOGY (kept deliberately simple for this MVP — see DISCLAIMER):
 *   1. Every active batch (REVOKED/SUPERSEDED excluded, same
 *      EXCLUDED_STATUSES convention as esg-analytics.ts and
 *      plastic-tax-calculator.ts) with recorded weight data is bucketed
 *      by the calendar quarter of its productionDate ("YYYY-QN").
 *   2. Each batch's liability is computed using the PlasticTaxParameter
 *      rate that was actually effective on ITS OWN productionDate (not
 *      today's rate) — this is what lets a historical rate change show
 *      up correctly in the trend, per this sprint's explicit request to
 *      aggregate "tax parameter changes" alongside batch valuations.
 *   3. With at least MIN_QUARTERS_FOR_FORECAST actual quarters of data,
 *      an ordinary-least-squares linear trend is fit independently to
 *      the trailing quarters' grossLiabilityEur and pcrTaxSavingsEur
 *      series, then projected forward FORECAST_QUARTERS quarters.
 *      netLiabilityEur is always derived as gross − savings (never
 *      regressed independently), so forecast figures stay internally
 *      consistent the same way live figures already are. Forecast
 *      values are floored at 0 (a liability can't go negative).
 *      Fewer than MIN_QUARTERS_FOR_FORECAST actual quarters → no
 *      forecast is attempted at all (hasSufficientData: false) rather
 *      than extrapolating from too little data.
 *   4. Actual quarters are also rolled up into actual calendar-year
 *      totals for the yearly table; the "next 12 months" forecast is a
 *      ROLLING window (the four forecast quarters immediately following
 *      the last actual quarter), not a calendar-year projection — this
 *      avoids the edge case of a partial forecast year and is labeled
 *      as such in the UI, not implied to be a Jan–Dec figure.
 */

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_JURISDICTION,
  DEFAULT_TAX_RATE_EUR_PER_TONNE,
  deriveMassFigures,
  computeLiability,
  listTaxParameters,
  round2,
} from "@/lib/services/plastic-tax-calculator";

const MIN_QUARTERS_FOR_FORECAST = 3;
const FORECAST_QUARTERS = 4;
const TRAILING_WINDOW_QUARTERS = 4;

const EXCLUDED_STATUSES = new Set(["REVOKED", "SUPERSEDED"]);

export const FORECAST_METHODOLOGY =
  "Ordinary-least-squares linear trend fit to the trailing quarters' actual gross liability and PCR tax savings, " +
  "projected forward. Net liability is always gross minus savings, never forecast independently, so figures stay " +
  "internally consistent. Forecast values are floored at zero.";

export const FORECAST_DISCLAIMER =
  "Illustrative planning indicator only, not tax or legal advice or a financial projection. Based on a simple " +
  "linear extrapolation of past production volume, PCR mass, and the tax rate effective at each batch's " +
  "production date — it does not model future production changes, PCR adoption shifts, or tax-rate changes " +
  "beyond the currently active rate. Consult a qualified tax advisor before relying on these figures.";

export interface GreenTaxQuarterPoint {
  quarter: string; // "2026-Q3"
  isForecast: boolean;
  batchCount: number;
  lockedValuationsInQuarter: number; // count of GREEN_VALUATION_SAVED audit events in this quarter, 0 for forecast points
  totalMassKg: number;
  totalPcrMassKg: number;
  totalTaxableMassKg: number;
  avgRatePerTonneEur: number;
  grossLiabilityEur: number;
  pcrTaxSavingsEur: number;
  netLiabilityEur: number;
}

export interface GreenTaxYearPoint {
  label: string; // "2026" for an actual calendar year, "Next 12 Months" for the rolling forecast
  isForecast: boolean;
  quarterCount: number;
  grossLiabilityEur: number;
  pcrTaxSavingsEur: number;
  netLiabilityEur: number;
}

export interface GreenTaxForecastFigures {
  grossLiabilityEur: number;
  pcrTaxSavingsEur: number;
  netLiabilityEur: number;
}

export interface GreenTaxTrendForecastSummary {
  generatedAt: string;
  jurisdiction: string;
  hasSufficientData: boolean;
  minQuartersRequired: number;
  quartersAvailable: number;
  quarterly: GreenTaxQuarterPoint[];
  yearly: GreenTaxYearPoint[];
  nextQuarterForecast: (GreenTaxForecastFigures & { quarter: string }) | null;
  next12MonthsForecast: GreenTaxForecastFigures | null;
  trailingActual: (GreenTaxForecastFigures & { quarterCount: number }) | null;
  projectedNetChangePercent: number | null;
  methodology: string;
  disclaimer: string;
}

function quarterKeyOfDate(date: Date): string {
  const q = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${date.getUTCFullYear()}-Q${q}`;
}

function quarterIndex(key: string): number {
  const [yStr, qStr] = key.split("-Q");
  return Number(yStr) * 4 + (Number(qStr) - 1);
}

function quarterKeyFromIndex(idx: number): string {
  const year = Math.floor(idx / 4);
  const q = (idx % 4) + 1;
  return `${year}-Q${q}`;
}

function yearOfQuarterKey(key: string): string {
  return key.split("-Q")[0];
}

interface RateWindow {
  ratePerTonne: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

/** Builds an in-memory lookup rather than one DB query per batch. */
function makeRateResolver(windows: RateWindow[]) {
  const sorted = [...windows].sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());
  return (date: Date): number => {
    let matched: number | null = null;
    for (const w of sorted) {
      if (w.effectiveFrom.getTime() <= date.getTime() && (w.effectiveTo === null || w.effectiveTo.getTime() >= date.getTime())) {
        matched = w.ratePerTonne;
      }
    }
    return matched ?? DEFAULT_TAX_RATE_EUR_PER_TONNE;
  };
}

/** Simple OLS: y = intercept + slope * x, over x = 0..n-1. */
function fitLinearTrend(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  const xs = values.map((_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((sum, x, i) => sum + x * values[i], 0);
  const sumX2 = xs.reduce((sum, x) => sum + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) {
    // Degenerate (shouldn't happen given MIN_QUARTERS_FOR_FORECAST >= 3), fall back to a flat trend.
    return { slope: 0, intercept: sumY / n };
  }
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export async function computeGreenTaxTrendForecast(
  jurisdiction: string = DEFAULT_JURISDICTION
): Promise<GreenTaxTrendForecastSummary> {
  const [passports, taxParams, lockedValuationLogs] = await Promise.all([
    prisma.polymerPassport.findMany({
      select: {
        status: true,
        productionDate: true,
        recycledContentSource: true,
        recycledContentPercent: true,
        carbonFootprintCalculation: { select: { weightKg: true } },
      },
    }),
    listTaxParameters(jurisdiction),
    prisma.auditLog.findMany({
      where: { action: "GREEN_VALUATION_SAVED" },
      select: { createdAt: true },
    }),
  ]);

  const resolveRate = makeRateResolver(
    taxParams.map((p) => ({
      ratePerTonne: p.ratePerTonne,
      effectiveFrom: new Date(p.effectiveFrom),
      effectiveTo: p.effectiveTo ? new Date(p.effectiveTo) : null,
    }))
  );

  interface Accumulator {
    batchCount: number;
    totalMassKg: number;
    totalPcrMassKg: number;
    totalTaxableMassKg: number;
    grossLiabilityEur: number;
    pcrTaxSavingsEur: number;
    netLiabilityEur: number;
  }
  const buckets = new Map<string, Accumulator>();

  for (const p of passports) {
    if (EXCLUDED_STATUSES.has(p.status)) continue;
    const weightKg = p.carbonFootprintCalculation ? Number(p.carbonFootprintCalculation.weightKg) : null;
    const { hasWeightData, batchMassKg, pcrMassKg } = deriveMassFigures(
      weightKg,
      p.recycledContentSource,
      Number(p.recycledContentPercent)
    );
    if (!hasWeightData) continue;

    const rate = resolveRate(p.productionDate);
    const { taxableMassKg, grossLiabilityEur, pcrTaxSavingsEur, netLiabilityEur } = computeLiability(
      batchMassKg,
      pcrMassKg,
      rate
    );

    const key = quarterKeyOfDate(p.productionDate);
    const acc = buckets.get(key) ?? {
      batchCount: 0,
      totalMassKg: 0,
      totalPcrMassKg: 0,
      totalTaxableMassKg: 0,
      grossLiabilityEur: 0,
      pcrTaxSavingsEur: 0,
      netLiabilityEur: 0,
    };
    acc.batchCount += 1;
    acc.totalMassKg += batchMassKg;
    acc.totalPcrMassKg += pcrMassKg;
    acc.totalTaxableMassKg += taxableMassKg;
    acc.grossLiabilityEur += grossLiabilityEur;
    acc.pcrTaxSavingsEur += pcrTaxSavingsEur;
    acc.netLiabilityEur += netLiabilityEur;
    buckets.set(key, acc);
  }

  const lockedCountByQuarter = new Map<string, number>();
  for (const log of lockedValuationLogs) {
    const key = quarterKeyOfDate(log.createdAt);
    lockedCountByQuarter.set(key, (lockedCountByQuarter.get(key) ?? 0) + 1);
  }

  const actualKeys = Array.from(buckets.keys()).sort((a, b) => quarterIndex(a) - quarterIndex(b));

  const actualQuarters: GreenTaxQuarterPoint[] = actualKeys.map((key) => {
    const acc = buckets.get(key)!;
    return {
      quarter: key,
      isForecast: false,
      batchCount: acc.batchCount,
      lockedValuationsInQuarter: lockedCountByQuarter.get(key) ?? 0,
      totalMassKg: round2(acc.totalMassKg),
      totalPcrMassKg: round2(acc.totalPcrMassKg),
      totalTaxableMassKg: round2(acc.totalTaxableMassKg),
      avgRatePerTonneEur: acc.totalMassKg > 0 ? round2((acc.grossLiabilityEur / (acc.totalMassKg / 1000)) || 0) : 0,
      grossLiabilityEur: round2(acc.grossLiabilityEur),
      pcrTaxSavingsEur: round2(acc.pcrTaxSavingsEur),
      netLiabilityEur: round2(acc.netLiabilityEur),
    };
  });

  const quartersAvailable = actualQuarters.length;
  const hasSufficientData = quartersAvailable >= MIN_QUARTERS_FOR_FORECAST;

  let forecastQuarters: GreenTaxQuarterPoint[] = [];
  if (hasSufficientData) {
    const grossSeries = actualQuarters.map((q) => q.grossLiabilityEur);
    const savingsSeries = actualQuarters.map((q) => q.pcrTaxSavingsEur);
    const grossTrend = fitLinearTrend(grossSeries);
    const savingsTrend = fitLinearTrend(savingsSeries);

    const lastActualIndex = quarterIndex(actualKeys[actualKeys.length - 1]);
    const n = quartersAvailable;

    forecastQuarters = Array.from({ length: FORECAST_QUARTERS }, (_, k) => {
      const x = n + k;
      const gross = Math.max(0, grossTrend.intercept + grossTrend.slope * x);
      const savings = Math.max(0, savingsTrend.intercept + savingsTrend.slope * x);
      const net = Math.max(0, gross - savings);
      const key = quarterKeyFromIndex(lastActualIndex + 1 + k);
      return {
        quarter: key,
        isForecast: true,
        batchCount: 0,
        lockedValuationsInQuarter: 0,
        totalMassKg: 0,
        totalPcrMassKg: 0,
        totalTaxableMassKg: 0,
        avgRatePerTonneEur: 0,
        grossLiabilityEur: round2(gross),
        pcrTaxSavingsEur: round2(savings),
        netLiabilityEur: round2(net),
      };
    });
  }

  const quarterly = [...actualQuarters, ...forecastQuarters];

  // --- Yearly rollup (actual calendar years, from actual quarters only) ---
  const yearBuckets = new Map<string, { quarterCount: number; gross: number; savings: number; net: number }>();
  for (const q of actualQuarters) {
    const year = yearOfQuarterKey(q.quarter);
    const acc = yearBuckets.get(year) ?? { quarterCount: 0, gross: 0, savings: 0, net: 0 };
    acc.quarterCount += 1;
    acc.gross += q.grossLiabilityEur;
    acc.savings += q.pcrTaxSavingsEur;
    acc.net += q.netLiabilityEur;
    yearBuckets.set(year, acc);
  }
  const yearly: GreenTaxYearPoint[] = Array.from(yearBuckets.entries())
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([label, acc]) => ({
      label,
      isForecast: false,
      quarterCount: acc.quarterCount,
      grossLiabilityEur: round2(acc.gross),
      pcrTaxSavingsEur: round2(acc.savings),
      netLiabilityEur: round2(acc.net),
    }));

  let next12MonthsForecast: GreenTaxForecastFigures | null = null;
  let nextQuarterForecast: (GreenTaxForecastFigures & { quarter: string }) | null = null;
  if (forecastQuarters.length > 0) {
    const gross = forecastQuarters.reduce((s, q) => s + q.grossLiabilityEur, 0);
    const savings = forecastQuarters.reduce((s, q) => s + q.pcrTaxSavingsEur, 0);
    const net = forecastQuarters.reduce((s, q) => s + q.netLiabilityEur, 0);
    next12MonthsForecast = { grossLiabilityEur: round2(gross), pcrTaxSavingsEur: round2(savings), netLiabilityEur: round2(net) };
    yearly.push({
      label: "Next 12 Months",
      isForecast: true,
      quarterCount: forecastQuarters.length,
      ...next12MonthsForecast,
    });
    const first = forecastQuarters[0];
    nextQuarterForecast = {
      quarter: first.quarter,
      grossLiabilityEur: first.grossLiabilityEur,
      pcrTaxSavingsEur: first.pcrTaxSavingsEur,
      netLiabilityEur: first.netLiabilityEur,
    };
  }

  let trailingActual: (GreenTaxForecastFigures & { quarterCount: number }) | null = null;
  if (actualQuarters.length > 0) {
    const window = actualQuarters.slice(-TRAILING_WINDOW_QUARTERS);
    trailingActual = {
      quarterCount: window.length,
      grossLiabilityEur: round2(window.reduce((s, q) => s + q.grossLiabilityEur, 0)),
      pcrTaxSavingsEur: round2(window.reduce((s, q) => s + q.pcrTaxSavingsEur, 0)),
      netLiabilityEur: round2(window.reduce((s, q) => s + q.netLiabilityEur, 0)),
    };
  }

  let projectedNetChangePercent: number | null = null;
  if (trailingActual && next12MonthsForecast && trailingActual.netLiabilityEur > 0) {
    projectedNetChangePercent = round2(
      ((next12MonthsForecast.netLiabilityEur - trailingActual.netLiabilityEur) / trailingActual.netLiabilityEur) * 100
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    jurisdiction,
    hasSufficientData,
    minQuartersRequired: MIN_QUARTERS_FOR_FORECAST,
    quartersAvailable,
    quarterly,
    yearly,
    nextQuarterForecast,
    next12MonthsForecast,
    trailingActual,
    projectedNetChangePercent,
    methodology: FORECAST_METHODOLOGY,
    disclaimer: FORECAST_DISCLAIMER,
  };
}
