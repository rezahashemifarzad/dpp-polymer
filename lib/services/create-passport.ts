/**
 * lib/services/create-passport.ts
 * -----------------------------------------------------------------------
 * The single, canonical "create a polymer passport" business-logic path:
 * validation, manufacturer/batch checks, hashing, GS1 link, and the
 * atomic transaction that persists the passport + certifications + GS1
 * link + audit log row.
 *
 * Extracted out of app/api/passports/route.ts so there is exactly ONE
 * implementation, shared by both real entry points:
 *   - POST /api/passports (app/api/passports/route.ts) — external
 *     callers, gated by the API_SECRET_KEY check in that route.
 *   - createPassportAction (lib/actions/create-passport.ts) — the
 *     in-app dashboard/admin "Create Passport" flow, invoked as a Next.js
 *     Server Action so it never crosses the network as a client fetch
 *     and therefore never needs (or exposes) the API secret.
 *
 * This repo has already been bitten once by two divergent copies of this
 * exact logic drifting apart (see the STEP 5 note in route.ts) — do not
 * reintroduce a second copy. Any future change to how passports are
 * created belongs here, not in either caller.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PolymerPassportInputSchema, hashRecord, computeTotalRecycledPercent } from "@/lib/types";
import { buildGs1VerificationUrl } from "@/lib/qr";
import { writeAuditLog } from "@/lib/audit";

type PassportWithRelations = Prisma.PolymerPassportGetPayload<{
  include: { certifications: true; manufacturer: true; gs1Link: true };
}>;

type ZodFlatten = { formErrors: string[]; fieldErrors: Record<string, string[]> };

export type CreatePassportResult =
  | { ok: true; status: 201; data: PassportWithRelations }
  | { ok: false; status: 400; error: string; issues?: ZodFlatten }
  | { ok: false; status: 404 | 409; error: string };

/**
 * Validates `rawInput` and, if valid, persists a new PolymerPassport.
 * Expected failures (bad input, unknown manufacturer, duplicate batchId)
 * come back as an `{ ok: false, status, error }` result — never thrown —
 * so callers can translate them into the right response shape for their
 * transport (HTTP status for the API route, a plain result object for
 * the Server Action). Unexpected failures (DB unreachable, etc.) are
 * left to throw; each caller decides how to report those.
 */
export async function createPassport(rawInput: unknown): Promise<CreatePassportResult> {
  const parsed = PolymerPassportInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: "Validation failed",
      issues: parsed.error.flatten(),
    };
  }
  const data = parsed.data;

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { id: data.manufacturerId },
    select: { id: true },
  });
  if (!manufacturer) {
    return { ok: false, status: 404, error: `Manufacturer ${data.manufacturerId} not found` };
  }

  const existing = await prisma.polymerPassport.findUnique({
    where: { batchId: data.batchId },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false,
      status: 409,
      error: `A passport already exists for batchId "${data.batchId}"`,
    };
  }

  const totalRecycledPercent = computeTotalRecycledPercent({
    recycledContentPercent: data.recycledContentPercent,
  });

  const recordHash = hashRecord({ ...data, totalRecycledPercent });

  let qrCodePayloadUrl: string;
  let gs1ResolverUri: string;
  try {
    ({ url: qrCodePayloadUrl, path: gs1ResolverUri } = buildGs1VerificationUrl(
      data.gtin,
      data.batchId,
      recordHash
    ));
  } catch (err) {
    // Should be unreachable — GtinSchema already validates the check
    // digit — but never issue a passport with a QR pointing at a
    // malformed GTIN.
    return { ok: false, status: 400, error: (err as Error).message };
  }

  const created = await prisma.$transaction(async (tx) => {
    const passport = await tx.polymerPassport.create({
      data: {
        polymerType: data.polymerType,
        grade: data.grade,
        meltFlowIndex: data.meltFlowIndex,
        mfiTestStandard: data.mfiTestStandard,
        density: data.density,
        densityTestStandard: data.densityTestStandard,
        colorAdditives: data.colorAdditives,
        gtin: data.gtin,

        recycledContentSource: data.recycledContentSource,
        recycledContentPercent: data.recycledContentPercent,
        recycledContentCertScheme: data.recycledContentCertScheme,
        totalRecycledPercent,
        bioBasedPercent: data.bioBasedPercent,
        bioBasedTestStandard: data.bioBasedTestStandard,

        carbonFootprintKgCO2ePerKg: data.carbonFootprintKgCO2ePerKg,
        lcaMethodology: data.lcaMethodology,
        lcaScope: data.lcaScope,
        lcaThirdPartyVerified: data.lcaThirdPartyVerified,
        lcaVerifierName: data.lcaVerifierName,

        batchId: data.batchId,
        manufacturerId: data.manufacturerId,
        productionDate: data.productionDate,
        productionSiteGln: data.productionSiteGln,

        recordHash,
        hashAlgorithm: "SHA-256",
        previousRecordHash: null, // first version of this batch's lineage
        qrCodePayloadUrl,
        status: "PENDING_VERIFICATION",

        certifications: {
          create: data.certifications.map((c) => ({
            scheme: c.scheme,
            certificateId: c.certificateId,
            issuingBody: c.issuingBody,
            validFrom: c.validFrom,
            validUntil: c.validUntil,
            documentUrl: c.documentUrl,
          })),
        },

        // GS1 Digital Link resolver row — created in the SAME nested
        // write as the passport itself (Prisma nested writes inside an
        // interactive $transaction are atomic: either both rows commit
        // or neither does). This is what guarantees a freshly-created
        // passport is immediately resolvable by GTIN+batchId and can
        // never surface "No GS1 Link record found".
        gs1Link: {
          create: {
            gtin: data.gtin,
            batchId: data.batchId,
            resolverUri: gs1ResolverUri,
            targetUrl: qrCodePayloadUrl,
            recordHash,
          },
        },
      },
      include: { certifications: true, manufacturer: true, gs1Link: true },
    });

    await writeAuditLog(tx, {
      passportId: passport.id,
      action: "CREATED",
      actor: `manufacturer:${data.manufacturerId}`,
      previousHash: null,
      newHash: recordHash,
      metadata: { batchId: data.batchId, resolverUri: gs1ResolverUri },
    });

    return passport;
  });

  return { ok: true, status: 201, data: created };
}
