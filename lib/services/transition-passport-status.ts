/**
 * lib/services/transition-passport-status.ts
 * -----------------------------------------------------------------------
 * Shared core of every PolymerPassport status transition — extracted
 * unchanged (behavior-preserving) from app/api/passports/[batchId]/route.ts's
 * PATCH handler, which now calls this instead of inlining the logic.
 *
 * Why extract now: the Third-Party Auditor Verification Workflow needs the
 * exact same "validate transition -> re-chain the hash -> update -> write
 * audit log, all in one $transaction" sequence, but driven by a DIFFERENT
 * actor identity (a specific Auditor row, not a shared role key) and a
 * DIFFERENT AuditAction (AUDITOR_VERIFIED/AUDITOR_REJECTED, not
 * VERIFIED/REVOKED/SUPERSEDED). Rather than fork a second copy of this
 * logic in lib/services/submit-auditor-verification.ts and risk the two
 * drifting apart, both call this one function.
 *
 * `[batchId]/route.ts`'s PATCH endpoint's external behavior — request
 * shape, allowed transitions, response shape, error status codes — is
 * unchanged by this refactor. Only where the logic lives has moved.
 */

import { DppStatus, AuditAction, Prisma, PolymerPassport } from "@prisma/client";
import { hashRecord } from "@/lib/types";
import { writeAuditLog } from "@/lib/audit";

export const ALLOWED_TRANSITIONS: Record<DppStatus, DppStatus[]> = {
  DRAFT: ["PENDING_VERIFICATION", "REVOKED"],
  PENDING_VERIFICATION: ["ISSUED", "REVOKED"],
  ISSUED: ["REVOKED", "SUPERSEDED"],
  REVOKED: [],
  SUPERSEDED: [],
};

export class PassportNotFoundError extends Error {
  constructor(batchId: string) {
    super(`No passport found for batch "${batchId}"`);
    this.name = "PassportNotFoundError";
  }
}

export class InvalidTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot transition passport from "${from}" to "${to}"`);
    this.name = "InvalidTransitionError";
  }
}

export interface TransitionPassportStatusInput {
  batchId: string;
  nextStatus: DppStatus;
  /**
   * Written to PolymerPassport.signedBy and used as AuditLog.actor.
   * The generic role-key PATCH endpoint passes the role string (e.g.
   * "AUDITOR"); the auditor-verification service passes a specific
   * identity (e.g. "AUDITOR:<auditorId>") so the audit trail names the
   * individual, not just the role.
   */
  actor: string;
  auditAction: AuditAction;
  metadata?: Record<string, unknown>;
}

/**
 * Runs the transition inside the CALLER's transaction client (never opens
 * its own) — both call sites need this to participate in a larger
 * transaction (the auditor-verification service also writes an
 * AuditorVerification row in the same $transaction).
 */
export async function transitionPassportStatus(
  tx: Prisma.TransactionClient,
  { batchId, nextStatus, actor, auditAction, metadata }: TransitionPassportStatusInput
): Promise<PolymerPassport> {
  const current = await tx.polymerPassport.findUnique({ where: { batchId } });
  if (!current) {
    throw new PassportNotFoundError(batchId);
  }

  const allowed = ALLOWED_TRANSITIONS[current.status];
  if (!allowed.includes(nextStatus)) {
    throw new InvalidTransitionError(current.status, nextStatus);
  }

  const newHash = hashRecord({
    batchId: current.batchId,
    gtin: current.gtin,
    status: nextStatus,
    previousRecordHash: current.recordHash,
    transitionedAt: new Date(),
  });

  const passport = await tx.polymerPassport.update({
    where: { batchId },
    data: {
      status: nextStatus,
      previousRecordHash: current.recordHash,
      recordHash: newHash,
      signedAt: new Date(),
      signedBy: actor,
    },
    include: { certifications: true, manufacturer: true },
  });

  await writeAuditLog(tx, {
    passportId: passport.id,
    action: auditAction,
    actor,
    previousHash: current.recordHash,
    newHash,
    metadata,
  });

  return passport;
}
