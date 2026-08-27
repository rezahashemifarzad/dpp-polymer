/**
 * lib/services/declare-ppwr-compliance.ts
 * -----------------------------------------------------------------------
 * Sets or updates a PolymerPassport's PPWR (Packaging & Packaging Waste
 * Regulation) recyclability grade and PFAS-threshold compliance.
 *
 * Same "attach to an EXISTING batch, no verification gate" shape as
 * lib/services/declare-svhc-status.ts, and the same rationale: these are
 * self-assessed/lab-provided figures a manufacturer submits, not a
 * third-party certificate. Kept as a fully separate service and audit
 * action from declareSvhcStatus — a batch's recyclability grade and its
 * REACH SVHC status are reassessed independently and shouldn't be forced
 * to change together.
 *
 * Unlike declareSvhcStatus, every field here is independently optional —
 * see prisma/schema.prisma's PpwrRecyclabilityGrade comment for why this
 * data is nullable rather than required-with-default: most batches in
 * this system legitimately have no PPWR assessment at all (not every
 * polymer batch ends up in packaging).
 */

import { prisma } from "@/lib/prisma";
import { PpwrComplianceInputSchema } from "@/lib/types";
import { writeAuditLog } from "@/lib/audit";

type ZodFlatten = { formErrors: string[]; fieldErrors: Record<string, string[]> };

export type DeclarePpwrComplianceResult =
  | {
      ok: true;
      status: 200;
      data: {
        ppwrRecyclabilityGrade: string | null;
        ppwrPfasCompliant: boolean | null;
        ppwrPfasConcentrationPpb: string | null;
        ppwrAssessedAt: Date;
        ppwrAssessedBy: string;
      };
    }
  | { ok: false; status: 400; error: string; issues?: ZodFlatten }
  | { ok: false; status: 404; error: string };

/**
 * @param batchId  the PolymerPassport's batchId.
 * @param rawInput unvalidated request body — { recyclabilityGrade?, pfasCompliant?, pfasConcentrationPpb? }.
 * @param actor    identity to record as ppwrAssessedBy and on the
 *   PPWR_COMPLIANCE_DECLARED audit log entry.
 */
export async function declarePpwrCompliance(
  batchId: string,
  rawInput: unknown,
  actor: string
): Promise<DeclarePpwrComplianceResult> {
  const parsed = PpwrComplianceInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Validation failed", issues: parsed.error.flatten() };
  }
  const { recyclabilityGrade, pfasCompliant, pfasConcentrationPpb } = parsed.data;

  const passport = await prisma.polymerPassport.findUnique({
    where: { batchId },
    select: { id: true },
  });
  if (!passport) {
    return { ok: false, status: 404, error: `No passport found for batchId "${batchId}"` };
  }

  const assessedAt = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const passportRow = await tx.polymerPassport.update({
      where: { id: passport.id },
      data: {
        ppwrRecyclabilityGrade: recyclabilityGrade ?? null,
        ppwrPfasCompliant: pfasCompliant ?? null,
        ppwrPfasConcentrationPpb: pfasConcentrationPpb ?? null,
        ppwrAssessedAt: assessedAt,
        ppwrAssessedBy: actor,
      },
      select: {
        ppwrRecyclabilityGrade: true,
        ppwrPfasCompliant: true,
        ppwrPfasConcentrationPpb: true,
      },
    });

    await writeAuditLog(tx, {
      passportId: passport.id,
      action: "PPWR_COMPLIANCE_DECLARED",
      actor,
      previousHash: null,
      newHash: null,
      metadata: {
        recyclabilityGrade: recyclabilityGrade ?? null,
        pfasCompliant: pfasCompliant ?? null,
        pfasConcentrationPpb: pfasConcentrationPpb ?? null,
      },
    });

    return passportRow;
  });

  return {
    ok: true,
    status: 200,
    data: {
      ppwrRecyclabilityGrade: updated.ppwrRecyclabilityGrade,
      ppwrPfasCompliant: updated.ppwrPfasCompliant,
      ppwrPfasConcentrationPpb: updated.ppwrPfasConcentrationPpb?.toString() ?? null,
      ppwrAssessedAt: assessedAt,
      ppwrAssessedBy: actor,
    },
  };
}
