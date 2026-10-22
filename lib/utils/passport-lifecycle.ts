/**
 * lib/utils/passport-lifecycle.ts
 * -----------------------------------------------------------------------
 * No-Hard-Delete / Immutability Enforcement — small, pure, dependency-free
 * helpers for the "is this DPP/batch retired" question every caller needs
 * to answer, plus the shared policy text every DELETE-blocking route
 * handler returns.
 *
 * isPassportRevoked() is deliberately a computed function, not a stored
 * `isRevoked` boolean column — this app's established "compute, don't
 * store" convention (see e.g. lib/utils/certification-status.ts's own file
 * banner, or lib/verifyPassport.ts's note on why the "current" auditor
 * sign-off is resolved at read time rather than cached). PolymerPassport.
 * status (DppStatus) is already the single source of truth for a
 * passport's lifecycle state; a second boolean that has to be kept in sync
 * with it by every write path is a drift risk with no compensating
 * benefit — this one-line function is exactly as fast to call.
 */

import type { DppStatus } from "@prisma/client";

export function isPassportRevoked(status: DppStatus): boolean {
  return status === "REVOKED";
}

/**
 * Returned by every DELETE handler on a Passport/Batch/DPP resource.
 * Under EU ESPR/PPWR audit-trail requirements, a generated DPP or its
 * batch record must never be physically deleted — see
 * lib/services/transition-passport-status.ts's ALLOWED_TRANSITIONS (REVOKED
 * maps to [], a genuinely terminal state) and prisma/schema.prisma's
 * AuditLog/PolymerPassport comments for the hash-chained trail this
 * preserves. There was no DELETE route anywhere in this app before this
 * policy was made explicit (grep confirms it) — these handlers exist so
 * the "no hard delete, ever" policy is enforced and documented permanently
 * at the API layer, not just true by omission.
 */
export const NO_HARD_DELETE_POLICY_MESSAGE =
  'Hard deletion is not permitted for Digital Product Passports or batch records under this platform\'s EU ESPR/PPWR audit-trail policy. To retire a batch, use PATCH with { "status": "REVOKED", "reason": "..." } instead — the record and its full cryptographic audit history are preserved, never erased.';

/**
 * Public-disclosure rule (repository audit 2026-10-22).
 *
 * A passport's data is published to anonymous visitors only once it has left
 * the internal review flow: ISSUED, or the terminal states REVOKED /
 * SUPERSEDED (which keep showing their official notice). DRAFT and
 * PENDING_VERIFICATION records are manufacturer data that no auditor has
 * signed off yet, so every public surface — the GS1 scan page, the
 * Certificate of Conformity PDF, the public assistant and the anonymous
 * passport list — must treat them as not published.
 *
 * Single source of truth so those surfaces can never drift apart again.
 */
export const PUBLICLY_DISCLOSED_STATUSES: readonly DppStatus[] = ["ISSUED", "REVOKED", "SUPERSEDED"];

export function isPassportPubliclyDisclosed(status: DppStatus): boolean {
  return PUBLICLY_DISCLOSED_STATUSES.includes(status);
}
