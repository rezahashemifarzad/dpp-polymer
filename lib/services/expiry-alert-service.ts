/**
 * lib/services/expiry-alert-service.ts
 * -----------------------------------------------------------------------
 * Phase 4 - Step 1: Automated Expiry & Compliance Alerts.
 *
 * Two distinct responsibilities, deliberately kept separate:
 *
 *   1. computePortfolioExpiryAlerts() — READ side. Always live/computed
 *      fresh from Certification.validUntil (same "compute, don't store"
 *      principle as lib/utils/certification-status.ts's existing
 *      getCertificationAlertLevel). This is what powers the admin
 *      dashboard widget — it never depends on, or is gated by, the
 *      notification-bookkeeping fields below, so the widget always shows
 *      ground truth even if the background check hasn't run recently.
 *
 *   2. runExpiryAlertCheck() — WRITE side. The actual "background check"
 *      the sprint asks for: compares each certification's freshly
 *      computed tier against its stored lastNotifiedLevel, and only for
 *      certs whose tier has newly appeared or escalated, updates the
 *      notification-state fields and writes a CERT_EXPIRY_ALERT_RAISED
 *      AuditLog entry (reusing the existing audit trail — see
 *      docs/COMPLIANCE_CERTIFICATIONS_MODULE_SPEC.md §2.3's "reuse
 *      AuditLog, don't build a parallel system" rule). Meant to be
 *      invoked on a schedule (see vercel.json's cron entry hitting
 *      POST /api/certifications/expiry-check) or manually from the admin
 *      UI — never automatically on every dashboard page load, since that
 *      would turn a read into a side-effecting write on every render.
 *
 * acknowledgeExpiryAlert() lets an admin dismiss a raised alert from the
 * dashboard. Acknowledgment is deliberately cleared by runExpiryAlertCheck
 * whenever a cert's tier escalates further (e.g. EXPIRING_SOON, dismissed,
 * later becomes EXPIRED) — a worse situation should always resurface, even
 * if the earlier, milder warning was already seen.
 */

import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import {
  getExpiryAlertTier,
  isMoreSevere,
  EXPIRING_SOON_TIER_WINDOW_DAYS,
  EXPIRING_URGENT_WINDOW_DAYS,
  type ExpiryAlertTier,
} from "@/lib/utils/certification-status";

// Mirrors plastic-tax-calculator.ts's own EXCLUDED_STATUSES: a REVOKED
// passport's claims are withdrawn and a SUPERSEDED one has been replaced,
// so a certification attached to either isn't a live compliance risk
// worth surfacing on the portfolio-wide alert widget. Deliberately NOT
// applied to the existing per-row ledger badge (getPassportCertificationAlert
// in lib/utils/certification-status.ts) — that badge is a "what does this
// row look like" signal for an admin already looking at that specific
// passport, including a revoked one; this is a "what needs my attention
// right now, portfolio-wide" signal, where a withdrawn claim is noise.
const EXCLUDED_PASSPORT_STATUSES = new Set(["REVOKED", "SUPERSEDED"]);

// Never a silent cap — every response reports whether a tier's list was
// truncated, matching this app's established PDF/Excel export convention.
const MAX_ALERT_ROWS_PER_TIER = 50;

export interface ExpiryAlertRow {
  certificationId: string;
  batchId: string;
  polymerType: string;
  grade: string;
  manufacturerName: string | null;
  scheme: string;
  certificateId: string;
  validUntil: string;
  daysRemaining: number;
  tier: Exclude<ExpiryAlertTier, null>;
  verificationStatus: string;
  lastNotifiedLevel: string | null;
  alertAcknowledgedAt: string | null;
  alertAcknowledgedBy: string | null;
}

export interface PortfolioExpiryAlertSummary {
  generatedAt: string;
  thresholds: { expiringSoonDays: number; expiringUrgentDays: number };
  expiredCount: number;
  expiringUrgentCount: number;
  expiringSoonCount: number;
  unacknowledgedCount: number;
  expired: ExpiryAlertRow[];
  expiringUrgent: ExpiryAlertRow[];
  expiringSoon: ExpiryAlertRow[];
  expiredTruncated: boolean;
  expiringUrgentTruncated: boolean;
  expiringSoonTruncated: boolean;
}

/** Live portfolio-wide expiry summary — powers the admin dashboard widget. */
export async function computePortfolioExpiryAlerts(
  referenceDate: Date = new Date()
): Promise<PortfolioExpiryAlertSummary> {
  const cutoff = new Date(referenceDate.getTime() + EXPIRING_SOON_TIER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Index-backed range scan on Certification.validUntil (see the
  // @@index([validUntil]) added alongside these fields), narrowed further
  // by the passport-status exclusion above — never a full-table fetch.
  const candidates = await prisma.certification.findMany({
    where: {
      validUntil: { lte: cutoff },
      passport: { status: { notIn: Array.from(EXCLUDED_PASSPORT_STATUSES) } },
    },
    orderBy: { validUntil: "asc" },
    select: {
      id: true,
      scheme: true,
      certificateId: true,
      validUntil: true,
      verificationStatus: true,
      lastNotifiedLevel: true,
      alertAcknowledgedAt: true,
      alertAcknowledgedBy: true,
      passport: {
        select: {
          batchId: true,
          polymerType: true,
          grade: true,
          manufacturer: { select: { legalName: true } },
        },
      },
    },
  });

  const expired: ExpiryAlertRow[] = [];
  const expiringUrgent: ExpiryAlertRow[] = [];
  const expiringSoon: ExpiryAlertRow[] = [];
  let unacknowledgedCount = 0;

  for (const cert of candidates) {
    const tier = getExpiryAlertTier(cert.validUntil, referenceDate);
    // Guards drift between the SQL `lte: cutoff` bound above and this JS
    // classifier (e.g. a request straddling midnight) — should be rare,
    // never fatal if it happens.
    if (!tier) continue;

    const daysRemaining = Math.ceil((cert.validUntil.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
    const row: ExpiryAlertRow = {
      certificationId: cert.id,
      batchId: cert.passport.batchId,
      polymerType: cert.passport.polymerType,
      grade: cert.passport.grade,
      manufacturerName: cert.passport.manufacturer?.legalName ?? null,
      scheme: cert.scheme,
      certificateId: cert.certificateId,
      validUntil: cert.validUntil.toISOString(),
      daysRemaining,
      tier,
      verificationStatus: cert.verificationStatus,
      lastNotifiedLevel: cert.lastNotifiedLevel,
      alertAcknowledgedAt: cert.alertAcknowledgedAt ? cert.alertAcknowledgedAt.toISOString() : null,
      alertAcknowledgedBy: cert.alertAcknowledgedBy,
    };

    if (!cert.alertAcknowledgedAt) unacknowledgedCount++;

    if (tier === "EXPIRED") expired.push(row);
    else if (tier === "EXPIRING_URGENT") expiringUrgent.push(row);
    else expiringSoon.push(row);
  }

  return {
    generatedAt: referenceDate.toISOString(),
    thresholds: { expiringSoonDays: EXPIRING_SOON_TIER_WINDOW_DAYS, expiringUrgentDays: EXPIRING_URGENT_WINDOW_DAYS },
    expiredCount: expired.length,
    expiringUrgentCount: expiringUrgent.length,
    expiringSoonCount: expiringSoon.length,
    unacknowledgedCount,
    expired: expired.slice(0, MAX_ALERT_ROWS_PER_TIER),
    expiringUrgent: expiringUrgent.slice(0, MAX_ALERT_ROWS_PER_TIER),
    expiringSoon: expiringSoon.slice(0, MAX_ALERT_ROWS_PER_TIER),
    expiredTruncated: expired.length > MAX_ALERT_ROWS_PER_TIER,
    expiringUrgentTruncated: expiringUrgent.length > MAX_ALERT_ROWS_PER_TIER,
    expiringSoonTruncated: expiringSoon.length > MAX_ALERT_ROWS_PER_TIER,
  };
}

// Phase 7 - Step 1: Automated Notification & Webhook Suite. One entry per
// certification whose tier newly appeared or escalated during this check
// — exactly the set lib/services/notification-service.ts needs to decide
// what to notify about, without re-deriving escalation logic itself (see
// that file's own banner on why it consumes this list rather than
// duplicating this function's tier-vs-lastNotifiedLevel comparison).
// Purely additive to ExpiryAlertCheckResult below — existing callers that
// only read evaluated/newAlerts/escalated/unchanged are unaffected.
export interface RaisedExpiryEvent {
  certificationId: string;
  passportId: string;
  batchId: string;
  scheme: string;
  certificateId: string;
  tier: Exclude<ExpiryAlertTier, null>;
  previousTier: ExpiryAlertTier;
}

export interface ExpiryAlertCheckResult {
  checkedAt: string;
  evaluated: number;
  newAlerts: number;
  escalated: number;
  unchanged: number;
  raisedEvents: RaisedExpiryEvent[];
}

/**
 * The actual background check: evaluates every certification within the
 * alert window, and for any whose live tier has newly appeared or
 * escalated past what was last notified, persists the new notification
 * state and writes a CERT_EXPIRY_ALERT_RAISED audit entry. Idempotent —
 * running it twice in a row with no intervening changes produces zero
 * writes the second time (every cert's tier already matches lastNotifiedLevel).
 */
export async function runExpiryAlertCheck(
  actor: string,
  referenceDate: Date = new Date()
): Promise<ExpiryAlertCheckResult> {
  const cutoff = new Date(referenceDate.getTime() + EXPIRING_SOON_TIER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await prisma.certification.findMany({
    where: {
      validUntil: { lte: cutoff },
      passport: { status: { notIn: Array.from(EXCLUDED_PASSPORT_STATUSES) } },
    },
    select: {
      id: true,
      scheme: true,
      certificateId: true,
      validUntil: true,
      lastNotifiedLevel: true,
      passportId: true,
      // Phase 7 - Step 1: batchId is only needed to populate raisedEvents
      // below for the notification dispatcher — not used by the escalation
      // logic itself, so pulling it in here is purely additive to this
      // query's existing shape.
      passport: { select: { batchId: true } },
    },
  });

  let newAlerts = 0;
  let escalated = 0;
  let unchanged = 0;
  const raisedEvents: RaisedExpiryEvent[] = [];

  for (const cert of candidates) {
    const tier = getExpiryAlertTier(cert.validUntil, referenceDate);
    if (!tier) continue;

    const stored = cert.lastNotifiedLevel as ExpiryAlertTier | null;
    if (tier === stored) {
      unchanged++;
      continue;
    }

    if (isMoreSevere(tier, stored)) {
      await prisma.$transaction(async (tx) => {
        await tx.certification.update({
          where: { id: cert.id },
          data: {
            lastNotifiedLevel: tier,
            lastNotifiedAt: referenceDate,
            // Escalation means the situation got worse since any earlier
            // acknowledgment — clear it so the worse alert resurfaces.
            alertAcknowledgedAt: null,
            alertAcknowledgedBy: null,
          },
        });
        await writeAuditLog(tx, {
          passportId: cert.passportId,
          action: "CERT_EXPIRY_ALERT_RAISED",
          actor,
          previousHash: null,
          newHash: null,
          metadata: {
            certificationId: cert.id,
            scheme: cert.scheme,
            certificateId: cert.certificateId,
            tier,
            previousTier: stored,
          },
        });
      });
      if (stored === null) newAlerts++;
      else escalated++;
      raisedEvents.push({
        certificationId: cert.id,
        passportId: cert.passportId,
        batchId: cert.passport.batchId,
        scheme: cert.scheme,
        certificateId: cert.certificateId,
        tier,
        previousTier: stored,
      });
    } else {
      // The live tier is LESS severe than what's stored — shouldn't
      // normally happen (validUntil only moves forward in time as "now"
      // advances), but if a certification's validUntil is ever corrected
      // upward, silently leave the stored bookkeeping as-is rather than
      // downgrading a real, previously-raised alert without a person
      // deciding to acknowledge it.
      unchanged++;
    }
  }

  return {
    checkedAt: referenceDate.toISOString(),
    evaluated: candidates.length,
    newAlerts,
    escalated,
    unchanged,
    raisedEvents,
  };
}

export type AcknowledgeExpiryAlertResult =
  | { ok: true; status: 200 }
  | { ok: false; status: 404; error: string };

/** Admin-facing "dismiss this alert" action — see the file banner for why
 * acknowledgment is later cleared automatically on escalation. */
export async function acknowledgeExpiryAlert(
  certificationId: string,
  actor: string
): Promise<AcknowledgeExpiryAlertResult> {
  const cert = await prisma.certification.findUnique({
    where: { id: certificationId },
    select: { id: true, passportId: true, scheme: true, certificateId: true },
  });
  if (!cert) {
    return { ok: false, status: 404, error: `No certification found for id "${certificationId}"` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.certification.update({
      where: { id: certificationId },
      data: { alertAcknowledgedAt: new Date(), alertAcknowledgedBy: actor },
    });
    await writeAuditLog(tx, {
      passportId: cert.passportId,
      action: "CERT_EXPIRY_ALERT_ACKNOWLEDGED",
      actor,
      previousHash: null,
      newHash: null,
      metadata: { certificationId: cert.id, scheme: cert.scheme, certificateId: cert.certificateId },
    });
  });

  return { ok: true, status: 200 };
}
