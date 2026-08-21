/**
 * lib/services/verify-certification.ts
 * -----------------------------------------------------------------------
 * Moves a Certification from PENDING_REVIEW to VERIFIED or REJECTED.
 *
 * This is the Auditor/Admin-only counterpart to
 * lib/services/add-certification.ts: a manufacturer can attach a
 * certification, but only a separate actor can confirm or reject it —
 * mirroring the existing rule enforced for whole passports in
 * app/api/passports/[batchId]/route.ts (PENDING_VERIFICATION -> ISSUED
 * is gated to AUDITOR/ADMIN, never the submitter).
 *
 * A certification that has already been decided (VERIFIED or REJECTED)
 * cannot be silently overwritten by a second call — see the 409 case
 * below. A genuine "re-open a decided certification" flow is deliberately
 * NOT included here; if needed later it should be its own explicit,
 * separately-audited action rather than a side effect of calling this
 * one again.
 */

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export const VerifyCertificationInputSchema = z
  .object({
    decision: z.enum(["VERIFIED", "REJECTED"]),
    rejectionReason: z
      .string()
      .min(1, "rejectionReason is required when rejecting")
      .max(1000)
      .optional(),
  })
  .refine((d) => d.decision !== "REJECTED" || !!d.rejectionReason, {
    message: "rejectionReason is required when decision is REJECTED",
    path: ["rejectionReason"],
  });

type CertificationRow = Prisma.CertificationGetPayload<Record<string, never>>;

type ZodFlatten = { formErrors: string[]; fieldErrors: Record<string, string[]> };

export type VerifyCertificationResult =
  | { ok: true; status: 200; data: CertificationRow }
  | { ok: false; status: 400; error: string; issues?: ZodFlatten }
  | { ok: false; status: 404; error: string }
  | { ok: false; status: 409; error: string };

/**
 * @param certificationId the Certification row's id.
 * @param rawInput        unvalidated request body — { decision, rejectionReason? }.
 * @param actor           identity to record as verifiedBy and on the
 *   CERT_VERIFIED/CERT_REJECTED audit log entry (the RBAC role string
 *   from lib/rbac.ts's authorize(), e.g. "AUDITOR" or "ADMIN").
 */
export async function verifyCertification(
  certificationId: string,
  rawInput: unknown,
  actor: string
): Promise<VerifyCertificationResult> {
  const parsed = VerifyCertificationInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Validation failed", issues: parsed.error.flatten() };
  }
  const { decision, rejectionReason } = parsed.data;

  const existing = await prisma.certification.findUnique({
    where: { id: certificationId },
    select: {
      id: true,
      passportId: true,
      verificationStatus: true,
      scheme: true,
      certificateId: true,
    },
  });
  if (!existing) {
    return { ok: false, status: 404, error: `Certification ${certificationId} not found` };
  }

  if (existing.verificationStatus !== "PENDING_REVIEW") {
    return {
      ok: false,
      status: 409,
      error: `Certification ${certificationId} has already been ${existing.verificationStatus.toLowerCase()}`,
    };
  }

  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const certification = await tx.certification.update({
      where: { id: certificationId },
      data: {
        verificationStatus: decision,
        verifiedBy: actor,
        verifiedAt: now,
        rejectionReason: decision === "REJECTED" ? rejectionReason : null,
      },
    });

    await writeAuditLog(tx, {
      passportId: existing.passportId,
      action: decision === "VERIFIED" ? "CERT_VERIFIED" : "CERT_REJECTED",
      actor,
      previousHash: null,
      newHash: null,
      metadata: {
        certificationId: existing.id,
        scheme: existing.scheme,
        certificateId: existing.certificateId,
        ...(decision === "REJECTED" ? { rejectionReason } : {}),
      },
    });

    return certification;
  });

  return { ok: true, status: 200, data: updated };
}
