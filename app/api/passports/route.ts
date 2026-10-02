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
import { createPassport } from "@/lib/services/create-passport";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { resolveApiPrincipal } from "@/lib/api-auth";
import { getPassportCertificationAlert } from "@/lib/utils/certification-status";
import { NO_HARD_DELETE_POLICY_MESSAGE } from "@/lib/utils/passport-lifecycle";

const MAX_PAGE_SIZE = 100;

// Access-control audit (2026-09-30): lifecycle states an anonymous caller may
// see. DRAFT and PENDING_VERIFICATION batches are internal until issued;
// REVOKED/SUPERSEDED stay visible because their printed QR codes still
// resolve publicly and must show the revocation.
const PUBLIC_STATUSES: DppStatus[] = ["ISSUED", "REVOKED", "SUPERSEDED"];
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
  // Access-control audit (2026-09-30): this list powers the public Home page,
  // so anonymous callers are allowed — but they get the PUBLIC projection
  // only: issued/revoked/superseded passports, VERIFIED certifications and
  // VERIFIED chain-of-custody records. ADMIN/AUDITOR sessions and
  // ADMIN/AUDITOR/MANUFACTURER API keys get the full internal records.
  const { principal } = await resolveApiPrincipal(req, ["ADMIN", "AUDITOR", "MANUFACTURER"]);
  const isPrivileged = principal !== null;

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

    if (!isPrivileged) {
      if (statusParam && !PUBLIC_STATUSES.includes(statusParam as DppStatus)) {
        return NextResponse.json(
          { success: true, data: [], pagination: { page, pageSize, total: 0, totalPages: 1 } },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
      if (!statusParam) {
        where.status = { in: PUBLIC_STATUSES };
      }
    }

    const certificationWhere: Prisma.CertificationWhereInput = isPrivileged ? {} : { verificationStatus: "VERIFIED" };
    const custodyWhere: Prisma.ChainOfCustodyRecordWhereInput = isPrivileged ? {} : { status: "VERIFIED" };

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
          certifications: { where: certificationWhere },
          gs1Link: true,
          parentLinks: {
            include: {
              parentPassport: {
                select: {
                  id: true,
                  batchId: true,
                  gtin: true,
                  polymerType: true,
                  grade: true,
                  recycledContentPercent: true,
                  qrCodePayloadUrl: true,
                },
              },
            },
          },
          carbonFootprintCalculation: true,
          // Multi-tier Supply Chain Verification & Auditor Portal Expansion
          // — every tier record, all statuses (admin-facing shape). See
          // ChainOfCustodyRecord in prisma/schema.prisma.
          chainOfCustodyRecords: { where: custodyWhere, orderBy: { sequence: "asc" } },
          // REACH Article 33 SVHC Declaration — see the matching comment on
          // GET /api/passports/[batchId]'s own include block.
          substanceDeclarations: true,
        },
      }),
    ]);

    // Compliance Expiry Alerts (docs/CIRCULAR_ECONOMY_PLATFORM_UPGRADE_SPEC.md
    // §2.4) — computed here, not stored: Certification.validUntil is
    // already the source of truth, so this is derived fresh on every read
    // rather than a stored flag that could go stale between requests.
    const passportsWithAlerts = passports.map((passport) => ({
      ...passport,
      certificationAlert: getPassportCertificationAlert(passport.certifications),
    }));

    return NextResponse.json({
      success: true,
      data: passportsWithAlerts,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    }, { headers: { "Cache-Control": "no-store" } });
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
  const role = authorize(req, ["MANUFACTURER", "ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }

  // TODO(auth): the RBAC check above (lib/rbac.ts) closes the "open to
  // the whole internet" hole and unifies this route onto the same
  // role-key system as certifications and passport status transitions,
  // but it's still one shared key per role, not per-manufacturer
  // auth/session — it does not scope a manufacturer to their own account.
  // Once real per-manufacturer session auth exists, derive manufacturerId
  // from the authenticated session instead of trusting the request body,
  // so a manufacturer can't issue passports under someone else's ID.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Request body must be valid JSON" }, { status: 400 });
  }

  try {
    // Shared with the in-app dashboard/admin create flow — see
    // lib/services/create-passport.ts and lib/actions/create-passport.ts.
    // Validation, manufacturer/batch checks, hashing, GS1 link, and the
    // persist transaction all live there now; this route only handles
    // the HTTP-specific concerns (auth header, request body parsing,
    // status-code translation).
    const result = await createPassport(body);
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
    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
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

// No-Hard-Delete / Immutability Enforcement — a collection-level DELETE
// (bulk-delete-by-filter) never existed on this route either; blocked
// explicitly, same policy and message as app/api/passports/[batchId]/
// route.ts's DELETE — see lib/utils/passport-lifecycle.ts.
export async function DELETE() {
  return NextResponse.json(
    { success: false, error: NO_HARD_DELETE_POLICY_MESSAGE },
    { status: 405, headers: { Allow: "GET, POST" } }
  );
}
