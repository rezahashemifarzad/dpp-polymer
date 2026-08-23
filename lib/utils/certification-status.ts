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
