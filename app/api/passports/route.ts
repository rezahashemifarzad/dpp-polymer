/**
 * app/api/passports/route.ts
 * -----------------------------------------------------------------------
 * GET  /api/passports   — paginated, filterable list of passports.
 * POST /api/passports   — creates a new polymer passport.
 *
 * STEP 5 NOTE: this repo had two divergent drafts of this route. One
 * skipped Zod validation, hard-coded the carbon footprint to 1.25,
 * generated random/non-check-digit GTINs, and swallowed GET errors behind
 * a fake 200 response. The other (this one, kept and hardened) validates
 * with Zod, verifies the manufacturer and batch uniqueness, computes a
 * real SHA-256 record hash and GS1 Digital Link, and now also writes an
 * audit log entry. This file is the single canonical implementation —
 * do not reintroduce the unvalidated draft.
 *
 * POST flow:
 *   1. Validate the payload against PolymerPassportInputSchema (rejects
 *      malformed GTINs, missing certs, recycled% + bio-based% > 100, etc).
 *   2. Confirm the manufacturer exists.
 *   3. Confirm batchId is not already in use.
 *   4. Compute the canonical recordHash over the submitted claim data.
 *   5. Build the GS1 Digital Link URL (/01/{gtin}/21/{batchId} — matching
 *      the real resolver route app/01/[gtin]/21/[serialOrBatch]/page.tsx).
 *   6. Persist the passport + certifications and a CREATED audit log
 *      entry in a single transaction.
 *
 * Note on status: new passports are created as PENDING_VERIFICATION, not
 * ISSUED. Flipping to ISSUED happens via PATCH /api/passports/[batchId],
 * gated to the AUDITOR/ADMIN role (see lib/rbac.ts) — a manufacturer
 * submitting data should not be the same actor who marks it verified.
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma, DppStatus, PolymerType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PolymerPassportInputSchema, hashRecord, computeTotalRecycledPercent } from "@/lib/types";
import { buildGs1VerificationUrl } from "@/lib/qr";
import { writeAuditLog } from "@/lib/audit";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

function parsePagination(searchParams: URLSearchParams) {
  const pageRaw = Number(searchParams.get("page") ?? "1");
  const pageSizeRaw = Number(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE));
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
      ? Math.min(Math.floor(pageSizeRaw), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
  return { page, pageSize };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { page, pageSize } = parsePagination(searchParams);

    const statusParam = searchParams.get("status");
    const polymerTypeParam = searchParams.get("polymerType");
    const manufacturerId = searchParams.get("manufacturerId") ?? undefined;
    const search = searchParams.get("search")?.trim();

    const where: Prisma.PolymerPassportWhereInput = {};

    if (statusParam) {
      if (!Object.values(DppStatus).includes(statusParam as DppStatus)) {
        return NextResponse.json(
          { success: false, error: `Invalid status filter "${statusParam}"` },
          { status: 400 }
        );
      }
      where.status = statusParam as DppStatus;
    }

    if (polymerTypeParam) {
      if (!Object.values(PolymerType).includes(polymerTypeParam as PolymerType)) {
        return NextResponse.json(
          { success: false, error: `Invalid polymerType filter "${polymerTypeParam}"` },
          { status: 400 }
        );
      }
      where.polymerType = polymerTypeParam as PolymerType;
    }

    if (manufacturerId) {
      where.manufacturerId = manufacturerId;
    }

    if (search) {
      where.OR = [
        { grade: { contains: search, mode: "insensitive" } },
        { batchId: { contains: search, mode: "insensitive" } },
        { gtin: { contains: search } },
      ];
    }

    const [total, passports] = await prisma.$transaction([
      prisma.polymerPassport.count({ where }),
      prisma.polymerPassport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          manufacturer: { select: { id: true, legalName: true, country: true } },
          certifications: true,
          gs1Link: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: passports,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    console.error("GET /api/passports failed:", error);
    // Deliberately NOT `success: true` on failure — a caller filtering on
    // `success` must be able to tell "no rows" apart from "the query blew up".
    return NextResponse.json(
      { success: false, error: "Failed to load passports", data: [] },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = PolymerPassportInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // TODO(auth): once session auth is wired, derive manufacturerId from the
  // authenticated session instead of trusting the request body — a
  // manufacturer should only be able to issue passports under their own
  // account. Until then this endpoint must sit behind a network-level
  // boundary (API gateway / VPN) in production; it is not open to the
  // public internet.
  try {
    const manufacturer = await prisma.manufacturer.findUnique({
      where: { id: data.manufacturerId },
      select: { id: true },
    });
    if (!manufacturer) {
      return NextResponse.json(
        { success: false, error: `Manufacturer ${data.manufacturerId} not found` },
        { status: 404 }
      );
    }

    const existing = await prisma.polymerPassport.findUnique({
      where: { batchId: data.batchId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `A passport already exists for batchId "${data.batchId}"` },
        { status: 409 }
      );
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
      return NextResponse.json({ success: false, error: (err as Error).message }, { status: 400 });
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

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/passports failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to issue passport",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
