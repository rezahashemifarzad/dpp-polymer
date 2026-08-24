/**
 * lib/utils/certification-status.ts
 * -----------------------------------------------------------------------
 * Compliance Expiry Alerts (docs/CIRCULAR_ECONOMY_PLATFORM_UPGRADE_SPEC.md
 * §1.4 / §2.4 / §3.4). No new schema was needed for this feature —
 * Certification.validUntil (added by the Compliance & Green
 * Certifications Module) already IS the expiry date; this file just
 * derives an alert level from it at read time. Same "compute, don't
 * store" principle already used for why
 * CertificationVerificationStatus deliberately has no EXPIRED member.
 *
 * Pure and dependency-free — safe to call from an API route's response
 * mapper or directly from a client component.
 *
 * Phase 4 - Step 1 (Automated Expiry & Compliance Alerts) adds a second,
 * three-tier classifier (getExpiryAlertTier) alongside the original
 * two-tier getCertificationAlertLevel below. Deliberately NOT a change to
 * the existing function or its 30-day threshold: the admin ledger
 * (app/admin/page.tsx), the client portal (app/client-portal/page.tsx),
 * and esg-analytics.ts's compliance breakdown all already branch on
 * getCertificationAlertLevel's exact two-value return type
 * ("EXPIRED" | "EXPIRING_SOON"); inserting a third tier into that same
 * function would silently reclassify certs inside the new tier's window
 * out from under those callers' existing branches. The new function is
 * purely additive and used only by the new background check
 * (lib/services/expiry-alert-service.ts) and its dashboard widget.
 */

export type CertificationAlertLevel = "EXPIRED" | "EXPIRING_SOON" | null;

export const EXPIRING_SOON_WINDOW_DAYS = 30;

export function getCertificationAlertLevel(
  validUntil: Date | string,
  referenceDate: Date = new Date()
): CertificationAlertLevel {
  const expiry = validUntil instanceof Date ? validUntil : new Date(validUntil);
  const msRemaining = expiry.getTime() - referenceDate.getTime();

  if (msRemaining < 0) return "EXPIRED";

  const daysRemaining = msRemaining / (1000 * 60 * 60 * 24);
  if (daysRemaining <= EXPIRING_SOON_WINDOW_DAYS) return "EXPIRING_SOON";

  return null;
}

export interface PassportCertificationAlert {
  level: CertificationAlertLevel;
  expiredCount: number;
  expiringSoonCount: number;
}

/**
 * Aggregates the alert across every certification on a passport.
 *
 * Deliberately considers ALL certifications regardless of
 * verificationStatus — unlike the public scan page, which only ever
 * shows VERIFIED certifications, this is an admin-facing signal: an
 * admin needs to know a PENDING_REVIEW (or even REJECTED) certificate's
 * underlying document is about to lapse just as much as a VERIFIED
 * one's, since that's exactly the kind of thing that needs chasing up
 * with the manufacturer.
 */
export function getPassportCertificationAlert(
  certifications: Array<{ validUntil: Date | string }>,
  referenceDate: Date = new Date()
): PassportCertificationAlert {
  let expiredCount = 0;
  let expiringSoonCount = 0;

  for (const cert of certifications) {
    const level = getCertificationAlertLevel(cert.validUntil, referenceDate);
    if (level === "EXPIRED") expiredCount++;
    else if (level === "EXPIRING_SOON") expiringSoonCount++;
  }

  const level: CertificationAlertLevel =
    expiredCount > 0 ? "EXPIRED" : expiringSoonCount > 0 ? "EXPIRING_SOON" : null;

  return { level, expiredCount, expiringSoonCount };
}

// =============================================================================
// Phase 4 - Step 1 — Automated Expiry & Compliance Alerts
// =============================================================================

export type ExpiryAlertTier = "EXPIRED" | "EXPIRING_URGENT" | "EXPIRING_SOON" | null;

export const EXPIRING_URGENT_WINDOW_DAYS = 7;
// Re-exported so callers of the new tier system reference one source of
// truth for the "soon" cutoff rather than repeating the literal 30 — the
// existing EXPIRING_SOON_WINDOW_DAYS above already covers this value; this
// alias just gives the three-tier system its own explicitly-named constant.
export const EXPIRING_SOON_TIER_WINDOW_DAYS = EXPIRING_SOON_WINDOW_DAYS;

/**
 * Three-tier version of getCertificationAlertLevel, for the Automated
 * Expiry & Compliance Alerts feature specifically. Adds an
 * "EXPIRING_URGENT" tier (<= 7 days remaining) between EXPIRED and the
 * existing 30-day EXPIRING_SOON, so the background check and dashboard
 * widget can distinguish "renew this quarter" from "renew this week."
 */
export function getExpiryAlertTier(validUntil: Date | string, referenceDate: Date = new Date()): ExpiryAlertTier {
  const expiry = validUntil instanceof Date ? validUntil : new Date(validUntil);
  const msRemaining = expiry.getTime() - referenceDate.getTime();

  if (msRemaining < 0) return "EXPIRED";

  const daysRemaining = msRemaining / (1000 * 60 * 60 * 24);
  if (daysRemaining <= EXPIRING_URGENT_WINDOW_DAYS) return "EXPIRING_URGENT";
  if (daysRemaining <= EXPIRING_SOON_TIER_WINDOW_DAYS) return "EXPIRING_SOON";

  return null;
}

/** Ranks tiers by severity for comparing a freshly-computed tier against a
 * previously-stored one (e.g. "has this escalated since we last checked?"). */
const TIER_SEVERITY: Record<Exclude<ExpiryAlertTier, null>, number> = {
  EXPIRING_SOON: 1,
  EXPIRING_URGENT: 2,
  EXPIRED: 3,
};

export function isMoreSevere(a: ExpiryAlertTier, than: ExpiryAlertTier): boolean {
  const aRank = a ? TIER_SEVERITY[a] : 0;
  const bRank = than ? TIER_SEVERITY[than] : 0;
  return aRank > bRank;
}
