/**
 * lib/services/add-certification.ts
 * -----------------------------------------------------------------------
 * Attaches a new Certification to an EXISTING PolymerPassport batch.
 *
 * Closes the gap identified in docs/COMPLIANCE_CERTIFICATIONS_MODULE_SPEC.md
 * §2.4: certifications could previously only be created inside the nested
 * write in lib/services/create-passport.ts, at initial passport creation
 * time — there was no route to attach one afterward, even though real
 * certificates (an ISCC PLUS mass-balance renewal, a lab's late-arriving
 * ISO 14021 self-declaration) routinely show up after the batch record
 * already exists.
 *
 * A newly-added certification always starts verificationStatus =
 * PENDING_REVIEW (the Prisma column default) — this service never sets it
 * to VERIFIED itself. See lib/services/verify-certification.ts for the
 * separate, separately-audited action that does, per the spec's rule that
 * a manufacturer's own submission is never implicitly trusted.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CertificationInputSchema } from "@/lib/types";
import { writeAuditLog } from "@/lib/audit";

type CertificationRow = Prisma.CertificationGetPayload<Record<string, never>>;

type ZodFlatten = { formErrors: string[]; fieldErrors: Record<string, string[]> };

export type AddCertificationResult =
  | { ok: true; status: 201; data: CertificationRow }
  | { ok: false; status: 400; error: string; issues?: ZodFlatten }
  | { ok: false; status: 404; error: string };

/**
 * @param batchId  the PolymerPassport's batchId (not its internal id) —
 *   matches how every other passport-scoped route in this app addresses
 *   a passport, e.g. GET/PATCH /api/passports/[batchId].
 * @param rawInput unvalidated request body — validated here against
 *   CertificationInputSchema, same schema used for certifications
 *   submitted at initial passport creation.
 * @param actor    identity to record on the CERT_ADDED audit log entry
 *   (the RBAC role string from lib/rbac.ts's authorize(), e.g.
 *   "MANUFACTURER" or "ADMIN" — see app/api/passports/[batchId]/certifications/route.ts).
 */
export async function addCertificationToPassport(
  batchId: string,
  rawInput: unknown,
  actor: string
): Promise<AddCertificationResult> {
  const parsed = CertificationInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Validation failed", issues: parsed.error.flatten() };
  }
  const data = parsed.data;

  const passport = await prisma.polymerPassport.findUnique({
    where: { batchId },
    select: { id: true },
  });
  if (!passport) {
    return { ok: false, status: 404, error: `No passport found for batchId "${batchId}"` };
  }

  const created = await prisma.$transaction(async (tx) => {
    const certification = await tx.certification.create({
      data: {
        scheme: data.scheme,
        certificateId: data.certificateId,
        issuingBody: data.issuingBody,
        validFrom: data.validFrom,
        validUntil: data.validUntil,
        documentUrl: data.documentUrl,
        documentHash: data.documentHash,
        massBalanceAllocationPercent: data.massBalanceAllocationPercent,
        passportId: passport.id,
        // verificationStatus intentionally omitted — defaults to
        // PENDING_REVIEW at the schema level.
      },
    });

    await writeAuditLog(tx, {
      passportId: passport.id,
      action: "CERT_ADDED",
      actor,
      previousHash: null,
      newHash: null,
      metadata: {
        certificationId: certification.id,
        scheme: certification.scheme,
        certificateId: certification.certificateId,
      },
    });

    return certification;
  });

  return { ok: true, status: 201, data: created };
}
