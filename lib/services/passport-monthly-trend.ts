/**
 * lib/services/passport-monthly-trend.ts
 * -----------------------------------------------------------------------
 * Sprint 2.1 (Full Neon DB / PostgreSQL Integration) — this replaces the
 * last remaining mock data structure in the app: app/page.tsx's home
 * dashboard rendered its PCR/Compliance trend chart from a hard-coded
 * six-month array (`analyticsData`), explicitly flagged as temporary in
 * claude/step5-hardening-notes.md's "Explicit follow-ups" section
 * ("a real analytics time-series endpoint for the dashboard chart").
 * Every other data path in this app — the passport ledger, KPI cards,
 * create/verify/genealogy/carbon-footprint forms — was already live
 * against Neon via `usePassports()` and the `/api/passports` routes; this
 * was the one gap.
 *
 * "Compute, don't store" — same principle as lib/services/esg-analytics.ts:
 * computed fresh on every call from PolymerPassport rows, never cached or
 * written back, so there is no stale trend figure to drift from the ledger.
 *
 * Deliberately its OWN aggregation rather than reusing
 * getEsgAnalytics().monthlyTrend — that trend is scoped differently (it
 * excludes REVOKED/SUPERSEDED batches and only averages carbon intensity
 * over batches with a *positive* recorded figure) than what this chart
 * needs to reconcile with: the KPI cards directly above it in
 * app/page.tsx, whose `avgPcr` is a plain mean of totalRecycledPercent
 * over every currently-loaded batch, no exclusions. Duplicating a ~15-line
 * bucketing loop was judged less risky than quietly changing what number
 * the chart shows relative to the cards sitting right above it.
 *
 * `compliance` is a new, honestly-derived metric — % of a month's batches
 * whose status is ISSUED (i.e. actually passed AUDITOR/ADMIN verification,
 * see lib/services/transition-passport-status.ts) — not a stored field and
 * not a guess; DppStatus already models exactly this progression.
 *
 * Only months with at least one recorded batch are returned (no
 * zero-filled gap months), matching esg-analytics.ts's own convention.
 */

import { prisma } from "@/lib/prisma";

export interface PassportMonthlyTrendPoint {
  month: string; // "YYYY-MM", ascending
  avgPcr: number; // percent, 1 decimal — mean of totalRecycledPercent that month
  compliance: number; // percent of that month's batches with status ISSUED, 1 decimal
  batchCount: number;
}

export async function getPassportMonthlyTrend(monthsBack = 12): Promise<PassportMonthlyTrendPoint[]> {
  // Narrow select — only the three fields the bucketing below actually uses.
  const passports = await prisma.polymerPassport.findMany({
    select: {
      status: true,
      productionDate: true,
      totalRecycledPercent: true,
    },
  });

  const buckets = new Map<string, { count: number; pcrSum: number; issuedCount: number }>();
  for (const p of passports) {
    const month = p.productionDate.toISOString().slice(0, 7); // "YYYY-MM"
    const bucket = buckets.get(month) ?? { count: 0, pcrSum: 0, issuedCount: 0 };
    bucket.count++;
    bucket.pcrSum += Number(p.totalRecycledPercent);
    if (p.status === "ISSUED") bucket.issuedCount++;
    buckets.set(month, bucket);
  }

  const points: PassportMonthlyTrendPoint[] = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, b]) => ({
      month,
      avgPcr: Math.round((b.pcrSum / b.count) * 10) / 10,
      compliance: Math.round((b.issuedCount / b.count) * 1000) / 10,
      batchCount: b.count,
    }));

  return monthsBack > 0 ? points.slice(-monthsBack) : points;
}
