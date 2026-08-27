/**
 * app/api/erp/passports/route.ts
 * -----------------------------------------------------------------------
 * POST /api/erp/passports — automated batch intake for enterprise ERPs
 * (SAP, Microsoft Dynamics, or any system that can send an authenticated
 * HTTPS POST): MFI with its ISO 1133 test conditions, recyclate %, PCF
 * carbon footprint, and ISCC PLUS mass-balance credit data.
 *
 * This is deliberately a thin HTTP wrapper, not a new creation path:
 *   1. lib/erp-auth.ts resolves the caller to ONE specific, active
 *      Manufacturer via its own ERP key (x-dpp-manufacturer-key) — not
 *      the shared DPP_MANUFACTURER_API_KEY role key that POST
 *      /api/passports still uses.
 *   2. manufacturerId is forced to that resolved Manufacturer's id,
 *      overwriting anything the request body claims — an ERP integration
 *      can only ever create passports under its OWN manufacturer, closing
 *      the gap app/api/passports/route.ts's own TODO(auth) comment flags
 *      for the legacy route.
 *   3. lib/services/create-passport.ts's createPassport() is called
 *      completely unmodified — the SAME validation (PolymerPassportInputSchema
 *      already covers MFI + mfiTestStandard, density, recycledContentPercent,
 *      carbonFootprintKgCO2ePerKg, and a certifications[] array that already
 *      accepts scheme: "ISCC_PLUS" with massBalanceAllocationPercent — no
 *      new schema fields were needed for the data ERPs push), hashing,
 *      GS1 Digital Link generation, and CREATED audit entry every other
 *      creation path gets. This repo has already been bitten once by a
 *      second, drifted copy of passport-creation logic (see
 *      create-passport.ts's own file banner) — this route does not
 *      reintroduce that.
 *   4. On success, a SECOND, follow-up AuditLog entry is written with the
 *      new CREATED_VIA_ERP_INTEGRATION action, exactly mirroring how
 *      lib/services/supplier-submission.ts documents "this passport
 *      arrived through the Supplier Onboarding Portal" as a follow-up
 *      entry rather than changing what createPassport() itself records.
 *
 * Response shape matches every other write route in this app exactly:
 * { success: false, error, issues? } on failure, { success: true, data }
 * on success — see POST /api/passports and POST /api/supplier/invite/[token].
 *
 * Idempotency / retry safety: an ERP's own retry logic may re-send the
 * same batchId after a timeout with no way to know if the first attempt
 * landed. createPassport()'s pre-check already returns a friendly 409 for
 * an existing batchId, and a genuine race between two near-simultaneous
 * retries is now ALSO translated to that same 409 (see the P2002 handling
 * added to create-passport.ts) rather than surfacing as an opaque 500 —
 * an ERP's retry-on-5xx logic can safely treat 409 as "already created,
 * stop retrying" instead of retrying forever.
 *
 * Explicitly out of scope for this phase (see claude/erp-integration-notes.md
 * for the full rationale): a review/approval queue before passports go
 * live (ERPs are trusted first-party systems, unlike open supplier
 * invites — this is a direct-to-passport path by design); a standalone
 * ISCC PLUS mass-balance credit ledger (a decrementing pool) — the
 * existing per-certification massBalanceAllocationPercent field is what's
 * populated; outbound webhooks notifying the ERP of later status changes
 * (VERIFIED/REVOKED) — this route only covers inbound intake, and reuses
 * the existing WebhookEndpoint/dispatchWebhook suite from Phase 7 as a
 * fast follow-up once this inbound path is proven in production.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeManufacturer, manufacturerUnauthorizedResponse } from "@/lib/erp-auth";
import { createPassport } from "@/lib/services/create-passport";
import { writeAuditLog } from "@/lib/audit";
import { NO_HARD_DELETE_POLICY_MESSAGE } from "@/lib/utils/passport-lifecycle";

export async function POST(req: Request) {
  const manufacturer = await authorizeManufacturer(req);
  if (!manufacturer) {
    return manufacturerUnauthorizedResponse();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Request body must be valid JSON" }, { status: 400 });
  }

  // Force manufacturerId to the authenticated caller's own id — see this
  // file's banner. `body` is validated as unknown by createPassport()'s
  // own Zod schema regardless of what shape it arrives in, so overwriting
  // this one field ahead of validation is safe even if the ERP omitted it
  // or a malicious caller tried to target another manufacturer.
  const scopedInput =
    body !== null && typeof body === "object" ? { ...(body as Record<string, unknown>), manufacturerId: manufacturer.id } : body;

  try {
    const result = await createPassport(scopedInput);
    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          ...("issues" in result ? { issues: result.issues } : {}),
        },
        { status: result.status }
      );
    }

    // Follow-up audit entry documenting the intake channel — see this
    // file's banner. Deliberately NOT wrapped in the same transaction as
    // createPassport()'s own write (there is no companion row to keep
    // atomic with it, unlike approveSupplierSubmission's SupplierSubmission
    // status update); writeAuditLog accepts a plain PrismaClient for
    // exactly this case.
    await writeAuditLog(prisma, {
      passportId: result.data.id,
      action: "CREATED_VIA_ERP_INTEGRATION",
      actor: `erp:manufacturer:${manufacturer.id}`,
      previousHash: null,
      newHash: result.data.recordHash,
      metadata: { batchId: result.data.batchId, manufacturerId: manufacturer.id },
    });

    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    console.error("POST /api/erp/passports failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to ingest batch from ERP",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// No-Hard-Delete / Immutability Enforcement — same policy as every other
// passport-resource route (see lib/utils/passport-lifecycle.ts). An ERP
// that needs to retire a batch should PATCH /api/passports/{batchId} with
// { status: "REVOKED" }, same as every other caller.
export async function DELETE() {
  return NextResponse.json(
    { success: false, error: NO_HARD_DELETE_POLICY_MESSAGE },
    { status: 405, headers: { Allow: "POST" } }
  );
}
