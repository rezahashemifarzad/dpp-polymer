/**
 * app/api/passports/{batchId}/chain-of-custody/route.ts
 * -----------------------------------------------------------------------
 * POST /api/passports/{batchId}/chain-of-custody — attach a new upstream
 *   supply-chain tier record to this passport. External-caller entry
 *   point, gated to MANUFACTURER or ADMIN via lib/rbac.ts (mirrors
 *   .../parents/route.ts). The in-app admin UI uses
 *   lib/actions/add-chain-of-custody-record.ts (a Server Action) instead —
 *   same pattern as batch genealogy and passport creation.
 *
 * GET /api/passports/{batchId}/chain-of-custody — public, unauthenticated
 *   list of every tier record for this passport, ordered by sequence
 *   (furthest upstream first). All statuses are returned here — this is
 *   the admin/authenticated-consumer shape; the public QR scan page
 *   filters to VERIFIED-only itself (see app/01/[gtin]/21/[serialOrBatch]/
 *   page.tsx), same convention as certifications elsewhere in this app.
 *
 * Params are awaited per Next.js 16 App Router conventions (dynamic
 * route params are async in this Next.js version — see AGENTS.md).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { addChainOfCustodyRecord } from "@/lib/services/add-chain-of-custody-record";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;

  const role = authorize(req, ["MANUFACTURER", "ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Request body must be valid JSON" }, { status: 400 });
  }

  try {
    const result = await addChainOfCustodyRecord(batchId, body, role);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error, ...("issues" in result ? { issues: result.issues } : {}) },
        { status: result.status }
      );
    }
    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    console.error(`POST /api/passports/${batchId}/chain-of-custody failed:`, error);
    return NextResponse.json({ success: false, error: "Failed to add chain-of-custody record" }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;

  try {
    const passport = await prisma.polymerPassport.findUnique({
      where: { batchId },
      select: { id: true },
    });
    if (!passport) {
      return NextResponse.json({ success: false, error: `No passport found for batchId "${batchId}"` }, { status: 404 });
    }

    const records = await prisma.chainOfCustodyRecord.findMany({
      where: { passportId: passport.id },
      orderBy: { sequence: "asc" },
    });

    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    console.error(`GET /api/passports/${batchId}/chain-of-custody failed:`, error);
    return NextResponse.json({ success: false, error: "Failed to load chain-of-custody records" }, { status: 500 });
  }
}
