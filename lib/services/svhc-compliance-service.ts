/**
 * lib/services/svhc-compliance-service.ts
 * -----------------------------------------------------------------------
 * Portfolio-wide REACH Article 33 SVHC compliance summary — same "READ
 * side, always live/computed fresh" role as
 * lib/services/expiry-alert-service.ts's computePortfolioExpiryAlerts, and
 * deliberately modeled on it closely, but simpler: there is no
 * notification-bookkeeping WRITE side to pair with this (no
 * lastNotifiedLevel/acknowledgment concept — svhcStatus is a manufacturer
 * declaration set directly via lib/services/declare-svhc-status.ts, not a
 * derived alert tier that escalates on its own the way certificate expiry
 * does), so this file has just the one function.
 *
 * Two tiers surfaced, not three:
 *   - notAssessed  — svhcStatus === "NOT_ASSESSED". The actionable gap
 *     this widget exists for: a batch with no REACH Article 33 position
 *     on file at all.
 *   - svhcPresent  — svhcStatus === "SVHC_PRESENT". Not a "problem" the
 *     way NOT_ASSESSED is (the declaration IS on file), but genuinely
 *     useful portfolio-wide visibility — surfaced as an informational
 *     tier, same "give an immediate overview" spirit as the request this
 *     widget was built for.
 * NONE_DECLARED is intentionally absent from this summary — it's the
 * fully-resolved state this whole widget is trying to help a manufacturer
 * reach, so listing every "all clear" batch here would bury the signal.
 */

import { prisma } from "@/lib/prisma";

// Mirrors expiry-alert-service.ts's EXCLUDED_PASSPORT_STATUSES exactly,
// and the same rationale: a REVOKED batch's compliance posture is
// withdrawn and a SUPERSEDED one has been replaced by a newer record, so
// neither is a live gap worth an admin's attention on a portfolio-wide
// widget, even if its svhcStatus happens to be NOT_ASSESSED.
const EXCLUDED_PASSPORT_STATUSES = new Set(["REVOKED", "SUPERSEDED"]);

// Never a silent cap — same convention as expiry-alert-service.ts's
// MAX_ALERT_ROWS_PER_TIER.
const MAX_ROWS_PER_TIER = 50;

export interface SvhcAlertRow {
  id: string;
  batchId: string;
  polymerType: string;
  grade: string;
  manufacturerName: string | null;
  status: string;
  createdAt: string;
}

export interface PortfolioSvhcComplianceSummary {
  generatedAt: string;
  notAssessedCount: number;
  svhcPresentCount: number;
  notAssessed: SvhcAlertRow[];
  svhcPresent: SvhcAlertRow[];
  notAssessedTruncated: boolean;
  svhcPresentTruncated: boolean;
}

function toRow(p: {
  id: string;
  batchId: string;
  polymerType: string;
  grade: string;
  status: string;
  createdAt: Date;
  manufacturer: { legalName: string } | null;
}): SvhcAlertRow {
  return {
    id: p.id,
    batchId: p.batchId,
    polymerType: p.polymerType,
    grade: p.grade,
    manufacturerName: p.manufacturer?.legalName ?? null,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
  };
}

/** Live portfolio-wide SVHC compliance summary — powers the admin dashboard widget. */
export async function computePortfolioSvhcSummary(): Promise<PortfolioSvhcComplianceSummary> {
  const [notAssessedRows, svhcPresentRows, notAssessedCount, svhcPresentCount] = await Promise.all([
    prisma.polymerPassport.findMany({
      where: { svhcStatus: "NOT_ASSESSED", status: { notIn: Array.from(EXCLUDED_PASSPORT_STATUSES) } },
      orderBy: { createdAt: "asc" }, // oldest-outstanding-first, same urgency-ordering spirit as expiry's soonest-first
      take: MAX_ROWS_PER_TIER,
      select: {
        id: true,
        batchId: true,
        polymerType: true,
        grade: true,
        status: true,
        createdAt: true,
        manufacturer: { select: { legalName: true } },
      },
    }),
    prisma.polymerPassport.findMany({
      where: { svhcStatus: "SVHC_PRESENT", status: { notIn: Array.from(EXCLUDED_PASSPORT_STATUSES) } },
      orderBy: { svhcStatusDeclaredAt: "desc" }, // most-recently-declared-first
      take: MAX_ROWS_PER_TIER,
      select: {
        id: true,
        batchId: true,
        polymerType: true,
        grade: true,
        status: true,
        createdAt: true,
        manufacturer: { select: { legalName: true } },
      },
    }),
    prisma.polymerPassport.count({
      where: { svhcStatus: "NOT_ASSESSED", status: { notIn: Array.from(EXCLUDED_PASSPORT_STATUSES) } },
    }),
    prisma.polymerPassport.count({
      where: { svhcStatus: "SVHC_PRESENT", status: { notIn: Array.from(EXCLUDED_PASSPORT_STATUSES) } },
    }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    notAssessedCount,
    svhcPresentCount,
    notAssessed: notAssessedRows.map(toRow),
    svhcPresent: svhcPresentRows.map(toRow),
    notAssessedTruncated: notAssessedCount > MAX_ROWS_PER_TIER,
    svhcPresentTruncated: svhcPresentCount > MAX_ROWS_PER_TIER,
  };
}
