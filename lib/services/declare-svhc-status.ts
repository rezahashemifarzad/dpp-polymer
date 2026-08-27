/**
 * lib/services/declare-svhc-status.ts
 * -----------------------------------------------------------------------
 * Sets or updates a PolymerPassport's REACH Article 33 SVHC status, and
 * (when status is SVHC_PRESENT) its substance declarations.
 *
 * Structurally mirrors lib/services/add-certification.ts's "attach to an
 * EXISTING batch" shape, but this is NOT a certification-style workflow:
 * there is no PENDING_REVIEW -> VERIFIED gate, because a REACH Article 33
 * declaration is the manufacturer's own binding legal statement, not a
 * third-party attestation an Auditor grants or denies. See
 * prisma/schema.prisma's SvhcStatus comment for why silence (no
 * declaration at all) must stay distinguishable from "assessed, none
 * found" — that's the whole reason this is a required-with-default status
 * field rather than an optional one.
 *
 * Calling this again REPLACES the current declaration (status and, if
 * present, the full substances list) rather than merging into it — a
 * re-declaration is a new point-in-time legal statement (e.g. "as of a
 * newer SVHC Candidate List revision, this batch now also contains X"),
 * not a patch. The previous declaration is not lost: it stays fully
 * reconstructable from the REACH_SVHC_DECLARED AuditLog history, exactly
 * how AuditorVerification's "one-to-many, current = latest" precedent
 * already handles the equivalent case for auditor sign-offs.
 */

import { prisma } from "@/lib/prisma";
import { SvhcDeclarationInputSchema } from "@/lib/types";
import { writeAuditLog } from "@/lib/audit";

type ZodFlatten = { formErrors: string[]; fieldErrors: Record<string, string[]> };

export type DeclareSvhcStatusResult =
  | {
      ok: true;
      status: 200;
      data: { svhcStatus: string; svhcStatusDeclaredAt: Date; svhcStatusDeclaredBy: string; substanceCount: number };
    }
  | { ok: false; status: 400; error: string; issues?: ZodFlatten }
  | { ok: false; status: 404; error: string };

/**
 * @param batchId  the PolymerPassport's batchId — same addressing
 *   convention as every other passport-scoped route in this app.
 * @param rawInput unvalidated request body — { status, substances? }.
 * @param actor    identity to record as svhcStatusDeclaredBy and on the
 *   REACH_SVHC_DECLARED audit log entry.
 */
export async function declareSvhcStatus(
  batchId: string,
  rawInput: unknown,
  actor: string
): Promise<DeclareSvhcStatusResult> {
  const parsed = SvhcDeclarationInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Validation failed", issues: parsed.error.flatten() };
  }
  const { status, substances } = parsed.data;

  const passport = await prisma.polymerPassport.findUnique({
    where: { batchId },
    select: { id: true },
  });
  if (!passport) {
    return { ok: false, status: 404, error: `No passport found for batchId "${batchId}"` };
  }

  const declaredAt = new Date();

  await prisma.$transaction(async (tx) => {
    // Replace, don't merge — see this file's banner. Previous rows stay
    // fully reconstructable via AuditLog, never physically lost, but this
    // model's own rows always reflect only the CURRENT declaration.
    await tx.substanceDeclaration.deleteMany({ where: { passportId: passport.id } });

    await tx.polymerPassport.update({
      where: { id: passport.id },
      data: {
        svhcStatus: status,
        svhcStatusDeclaredAt: declaredAt,
        svhcStatusDeclaredBy: actor,
        substanceDeclarations:
          status === "SVHC_PRESENT"
            ? {
                create: substances.map((s) => ({
                  casNumber: s.casNumber,
                  substanceName: s.substanceName,
                  concentrationPercent: s.concentrationPercent,
                  candidateListDate: s.candidateListDate,
                  safeUseInstructions: s.safeUseInstructions,
                  declaredAt,
                  declaredBy: actor,
                })),
              }
            : undefined,
      },
    });

    await writeAuditLog(tx, {
      passportId: passport.id,
      action: "REACH_SVHC_DECLARED",
      actor,
      previousHash: null,
      newHash: null,
      metadata: {
        status,
        substanceCount: substances.length,
        // Full substance detail (CAS numbers, concentrations) is kept off
        // the audit metadata itself and left to the SubstanceDeclaration
        // rows this same transaction just (re)created — avoids two
        // sources of truth for the actual declared data drifting apart.
      },
    });
  });

  return {
    ok: true,
    status: 200,
    data: {
      svhcStatus: status,
      svhcStatusDeclaredAt: declaredAt,
      svhcStatusDeclaredBy: actor,
      substanceCount: substances.length,
    },
  };
}
