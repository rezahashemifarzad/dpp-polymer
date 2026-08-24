/**
 * lib/services/add-chain-of-custody-record.ts
 * -----------------------------------------------------------------------
 * Attaches one upstream supply-chain tier (raw material supplier, recycler,
 * compounder, ...) to an existing PolymerPassport. See
 * prisma/schema.prisma's ChainOfCustodyRecord model for the full design
 * rationale (why this is a separate model from BatchGenealogyLink, why
 * its recordHash stays out of the parent passport's sealed hash chain).
 *
 * Sequencing: `sequence` is always server-assigned as "1 + the current max
 * sequence for this passport" — never caller-supplied — so tiers can never
 * collide or be submitted out of order by a racing/malicious client. Every
 * new record starts at ChainOfCustodyStatus.PENDING_REVIEW; only the
 * Auditor review action (review-chain-of-custody-record.ts) can move it
 * to VERIFIED/FLAGGED/REJECTED.
 */

import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { hashRecord, ChainOfCustodyInputSchema, type ChainOfCustodyInput } from "@/lib/types";

type ZodFlatten = { formErrors: string[]; fieldErrors: Record<string, string[]> };

export type AddChainOfCustodyRecordResult =
  | { ok: true; status: 201; data: { id: string; passportId: string; sequence: number } }
  | { ok: false; status: 400; error: string; issues?: ZodFlatten }
  | { ok: false; status: 404; error: string };

export async function addChainOfCustodyRecord(
  batchId: string,
  rawInput: unknown,
  actor: string
): Promise<AddChainOfCustodyRecordResult> {
  const parsed = ChainOfCustodyInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: "Invalid chain-of-custody record",
      issues: parsed.error.flatten(),
    };
  }
  const input: ChainOfCustodyInput = parsed.data;

  const passport = await prisma.polymerPassport.findUnique({
    where: { batchId },
    select: { id: true },
  });
  if (!passport) {
    return { ok: false, status: 404, error: `No passport found for batchId "${batchId}"` };
  }

  const created = await prisma.$transaction(async (tx) => {
    // Next sequence for this passport — computed inside the transaction so
    // two concurrent adds against the same passport can't both read the
    // same max and collide (the @@unique([passportId, sequence]) DB
    // constraint is the final backstop if that ever happens anyway).
    const last = await tx.chainOfCustodyRecord.findFirst({
      where: { passportId: passport.id },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });
    const sequence = (last?.sequence ?? 0) + 1;

    // Canonical claim for this tier's own tamper-evidence seal — mirrors
    // hashRecord's use elsewhere, but scoped to this record only. This
    // hash is NOT folded into the parent passport's recordHash (see the
    // schema's model banner); a post-issuance chain-of-custody addition
    // must never retroactively invalidate the sealed passport hash.
    const recordHash = hashRecord({
      passportId: passport.id,
      sequence,
      tier: input.tier,
      participantName: input.participantName,
      participantCountry: input.participantCountry ?? null,
      externalBatchId: input.externalBatchId,
      certificationScheme: input.certificationScheme ?? null,
      certificateId: input.certificateId ?? null,
      certificateDocumentUrl: input.certificateDocumentUrl ?? null,
      certificateDocumentHash: input.certificateDocumentHash ?? null,
      massBalanceAllocationPercent: input.massBalanceAllocationPercent ?? null,
      notes: input.notes ?? null,
    });

    const record = await tx.chainOfCustodyRecord.create({
      data: {
        passportId: passport.id,
        sequence,
        tier: input.tier,
        participantName: input.participantName,
        participantCountry: input.participantCountry ?? null,
        externalBatchId: input.externalBatchId,
        certificationScheme: input.certificationScheme ?? null,
        certificateId: input.certificateId ?? null,
        certificateDocumentUrl: input.certificateDocumentUrl ?? null,
        certificateDocumentHash: input.certificateDocumentHash ?? null,
        massBalanceAllocationPercent: input.massBalanceAllocationPercent ?? null,
        notes: input.notes ?? null,
        recordHash,
      },
    });

    await writeAuditLog(tx, {
      passportId: passport.id,
      action: "COC_ADDED",
      actor,
      previousHash: null,
      newHash: recordHash,
      metadata: { sequence, tier: input.tier, participantName: input.participantName, externalBatchId: input.externalBatchId },
    });

    return record;
  });

  return {
    ok: true,
    status: 201,
    data: { id: created.id, passportId: created.passportId, sequence: created.sequence },
  };
}
