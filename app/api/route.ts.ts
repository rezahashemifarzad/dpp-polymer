/**
 * app/api/passports/route.ts
 * -----------------------------------------------------------------------
 * POST /api/passports
 *
 * Creates a new polymer passport. Flow:
 *   1. Validate the payload against PolymerPassportInputSchema (rejects
 *      malformed GTINs, missing certs, recycled%+bio-based% > 100, etc. —
 *      see types.ts for the cross-field rules).
 *   2. Confirm the manufacturer exists.
 *   3. Confirm batchId is not already in use (each batch gets exactly one
 *      passport lineage).
 *   4. Compute the canonical recordHash over the submitted claim data.
 *   5. Build the GS1 Digital Link URL (/01/{gtin}/21/{batchId}) and
 *      generate its QR payload URL.
 *   6. Persist the passport + its certifications in a single transaction.
 *
 * Note on status: new passports are created as PENDING_VERIFICATION, not
 * ISSUED. Flipping to ISSUED is intentionally a *separate* action (a future
 * PATCH /api/passports/[batchId]/verify, gated to the Auditor/Certifier
 * role per the RBAC model) — a manufacturer submitting data should not be
 * the same actor who marks it verified.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PolymerPassportInputSchema, hashRecord, computeTotalRecycledPercent } from "@/lib/types";
import { buildGs1VerificationUrl } from "@/lib/qr";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = PolymerPassportInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // TODO(auth): once auth is wired, derive manufacturerId from the session
  // instead of trusting the request body — a manufacturer should only be
  // able to issue passports under their own account.
  const manufacturer = await prisma.manufacturer.findUnique({
    where: { id: data.manufacturerId },
    select: { id: true },
  });
  if (!manufacturer) {
    return NextResponse.json({ error: `Manufacturer ${data.manufacturerId} not found` }, { status: 404 });
  }

  const existing = await prisma.polymerPassport.findUnique({
    where: { batchId: data.batchId },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: `A passport already exists for batchId "${data.batchId}"` },
      { status: 409 }
    );
  }

  const totalRecycledPercent = computeTotalRecycledPercent({
    recycledContentPercent: data.recycledContentPercent,
  });

  const recordHash = hashRecord({ ...data, totalRecycledPercent });

  let qrCodePayloadUrl: string;
  try {
    ({ url: qrCodePayloadUrl } = buildGs1VerificationUrl(data.gtin, data.batchId, recordHash));
  } catch (err) {
    // Should be unreachable — GtinSchema already validates the check digit —
    // but never issue a passport with a QR pointing at a malformed GTIN.
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const created = await prisma.polymerPassport.create({
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
    },
    include: { certifications: true, manufacturer: true },
  });

  return NextResponse.json(created, { status: 201 });
}
