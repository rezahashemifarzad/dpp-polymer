/**
 * lib/services/review-chain-of-custody-record.ts
 * -----------------------------------------------------------------------
 * An individually-authenticated Auditor reviews one Chain-of-Custody tier
 * record — VERIFIED, FLAGGED, or REJECTED. Scoped to a single record, not
 * the whole passport: distinct from submit-auditor-verification.ts, which
 * signs off on (or rejects) an entire passport out of PENDING_VERIFICATION.
 * A passport can carry several tier records under review independently of
 * its own top-level status.
 *
 * reviewNotes is required for FLAGGED/REJECTED (an auditor must explain
 * why a supplied tier record is being challenged) but optional for
 * VERIFIED — mirrors the Certification model's own
 * "rejectionReason required by the API, not the DB" convention.
 *
 * Every decision writes a permanent AuditLog row (COC_VERIFIED /
 * COC_FLAGGED / COC_REJECTED) in the same $transaction as the record
 * update, so the review action and its audit trail entry always commit
 * together.
 */

import { Auditor, ChainOfCustodyStatus, AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export interface ReviewChainOfCustodyRecordInput {
  status: ChainOfCustodyStatus; // "VERIFIED" | "FLAGGED" | "REJECTED"
  reviewNotes?: string;
}

export type ReviewChainOfCustodyRecordResult =
  | { ok: true; status: 200; data: { id: string; status: ChainOfCustodyStatus } }
  | { ok: false; status: 400; error: string }
  | { ok: false; status: 404; error: string }
  | { ok: false; status: 409; error: string };

const AUDIT_ACTION_BY_STATUS: Partial<Record<ChainOfCustodyStatus, AuditAction>> = {
  VERIFIED: "COC_VERIFIED",
  FLAGGED: "COC_FLAGGED",
  REJECTED: "COC_REJECTED",
};

const REVIEWABLE_TARGET_STATUSES: ChainOfCustodyStatus[] = ["VERIFIED", "FLAGGED", "REJECTED"];

export async function reviewChainOfCustodyRecord(
  batchId: string,
  recordId: string,
  auditor: Auditor,
  input: ReviewChainOfCustodyRecordInput
): Promise<ReviewChainOfCustodyRecordResult> {
  const { status, reviewNotes } = input;

  if (!REVIEWABLE_TARGET_STATUSES.includes(status)) {
    return { ok: false, status: 400, error: `status must be one of ${REVIEWABLE_TARGET_STATUSES.join(", ")}` };
  }
  if ((status === "FLAGGED" || status === "REJECTED") && !reviewNotes?.trim()) {
    return { ok: false, status: 400, error: "reviewNotes is required when flagging or rejecting a record" };
  }

  const record = await prisma.chainOfCustodyRecord.findUnique({
    where: { id: recordId },
    select: { id: true, status: true, passport: { select: { id: true, batchId: true } } },
  });

  if (!record || record.passport.batchId !== batchId) {
    return { ok: false, status: 404, error: `No chain-of-custody record "${recordId}" found for batchId "${batchId}"` };
  }

  if (record.status !== "PENDING_REVIEW") {
    return {
      ok: false,
      status: 409,
      error: `Record is already "${record.status}" — only PENDING_REVIEW records can be reviewed`,
    };
  }

  const actor = `AUDITOR:${auditor.id}`;

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.chainOfCustodyRecord.update({
      where: { id: recordId },
      data: {
        status,
        reviewedBy: actor,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes?.trim() || null,
      },
    });

    await writeAuditLog(tx, {
      passportId: record.passport.id,
      action: AUDIT_ACTION_BY_STATUS[status]!,
      actor,
      previousHash: null,
      newHash: saved.recordHash,
      metadata: { chainOfCustodyRecordId: recordId, decision: status, ...(reviewNotes ? { reviewNotes } : {}) },
    });

    return saved;
  });

  return { ok: true, status: 200, data: { id: updated.id, status: updated.status } };
}
