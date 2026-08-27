/**
 * lib/services/submit-auditor-verification.ts
 * -----------------------------------------------------------------------
 * Core logic for a single, individually-authenticated Auditor formally
 * signing off on (or rejecting) a passport under review. Called by
 * app/api/passports/[batchId]/verify/route.ts's PATCH — the repurposed
 * former placeholder endpoint — after lib/auditor-auth.ts's
 * authorizeAuditor() has resolved the request to a specific Auditor row.
 *
 * Scope, deliberately narrow:
 *   - Only a passport currently in PENDING_VERIFICATION may be reviewed
 *     here. This is the auditor's dedicated review queue, not a general
 *     status-editing endpoint — [batchId]/route.ts's PATCH (shared-role-key,
 *     any AUDITOR/ADMIN) remains the broader mechanism for
 *     DRAFT->PENDING_VERIFICATION, REVOKED, and SUPERSEDED transitions.
 *   - AUDITOR_VERIFIED reuses the exact integrity guardrail the old
 *     placeholder endpoint had: a passport whose stored data no longer
 *     matches its recordHash cannot be signed off on, since the auditor
 *     would be attesting to data they never actually reviewed.
 *   - REJECTED_BY_AUDITOR does not require integrity verification — a
 *     rejection is a statement about the review, not an attestation to the
 *     data's correctness, so a tampered/corrupt record can still be
 *     rejected (arguably that's exactly when it SHOULD be rejectable).
 *
 * Every decision — approve or reject — creates a permanent
 * AuditorVerification row AND drives the passport's own status via
 * transitionPassportStatus, both inside one $transaction: the two are
 * always written atomically, so a passport can never end up ISSUED
 * without a matching AuditorVerification row explaining who signed it.
 */

import { Auditor, AuditorVerificationStatus, AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashRecord } from "@/lib/types";
import { getVerifiedPassport } from "@/lib/verifyPassport";
import { transitionPassportStatus, InvalidTransitionError } from "@/lib/services/transition-passport-status";

export interface SubmitAuditorVerificationInput {
  decision: AuditorVerificationStatus; // "AUDITOR_VERIFIED" | "REJECTED_BY_AUDITOR"
  notes?: string;
}

export type SubmitAuditorVerificationResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; error: string };

const AUDIT_ACTION_BY_DECISION: Record<AuditorVerificationStatus, AuditAction> = {
  AUDITOR_VERIFIED: "AUDITOR_VERIFIED",
  REJECTED_BY_AUDITOR: "AUDITOR_REJECTED",
};

export async function submitAuditorVerification(
  batchId: string,
  auditor: Auditor,
  input: SubmitAuditorVerificationInput
): Promise<SubmitAuditorVerificationResult> {
  const { decision, notes } = input;

  // getVerifiedPassport re-derives integrityVerified by recomputing the
  // record hash from currently-stored data — the same check the public
  // scan page relies on — so this endpoint can't be tricked into a
  // sign-off on a since-tampered row just because the DB itself looks
  // plausible.
  const result = await getVerifiedPassport(batchId);
  if (!result) {
    return { ok: false, status: 404, error: `No passport found for batchId "${batchId}"` };
  }
  const { passport, integrityVerified } = result;

  if (passport.status !== "PENDING_VERIFICATION") {
    return {
      ok: false,
      status: 409,
      error: `Passport is "${passport.status}", not "PENDING_VERIFICATION" — only batches awaiting review can be signed off on through the auditor portal`,
    };
  }

  if (decision === "AUDITOR_VERIFIED" && !integrityVerified) {
    return {
      ok: false,
      status: 422,
      error: "Integrity check failed — stored data no longer matches recordHash. Cannot verify.",
    };
  }

  const actor = `AUDITOR:${auditor.id}`;
  const nextStatus = decision === "AUDITOR_VERIFIED" ? "ISSUED" : "REVOKED";

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Canonical claim signed by this verification — distinct from and in
      // addition to the passport's own recordHash chain (which
      // transitionPassportStatus re-seals separately below).
      const signedAt = new Date();
      const signatureHash = hashRecord({
        passportId: passport.id,
        batchId,
        auditorId: auditor.id,
        status: decision,
        notes: notes ?? null,
        signedAt,
      });

      const verification = await tx.auditorVerification.create({
        data: {
          passportId: passport.id,
          auditorId: auditor.id,
          status: decision,
          notes: notes ?? null,
          signatureHash,
          signedAt,
        },
      });

      const updatedPassport = await transitionPassportStatus(tx, {
        batchId,
        nextStatus,
        actor,
        auditAction: AUDIT_ACTION_BY_DECISION[decision],
        metadata: {
          auditorVerificationId: verification.id,
          decision,
          ...(notes ? { notes } : {}),
        },
        // No-Hard-Delete / Immutability Enforcement — this path's "why" is
        // the auditor's own rejection notes, not a `reason` field (this
        // service's own vocabulary, per this file's decision field above);
        // transitionPassportStatus takes it as an explicit parameter for
        // exactly this reason. Only meaningful when nextStatus is
        // "REVOKED" (i.e. decision === "REJECTED_BY_AUDITOR").
        revocationReason: nextStatus === "REVOKED" ? notes : undefined,
      });

      return { passport: updatedPassport, verification };
    });

    return { ok: true, status: 200, data: updated };
  } catch (error) {
    if (error instanceof InvalidTransitionError) {
      // Guards a race: passport moved out of PENDING_VERIFICATION between
      // the check above and the transaction (e.g. concurrently revoked via
      // the shared-role-key endpoint).
      return { ok: false, status: 409, error: error.message };
    }
    throw error;
  }
}
