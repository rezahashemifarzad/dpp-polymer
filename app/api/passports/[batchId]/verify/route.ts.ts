/**
 * app/api/passports/[batchId]/verify/route.ts
 * -----------------------------------------------------------------------
 * PATCH /api/passports/:batchId/verify
 *
 * The Auditor/Certifier-role action that flips a passport from
 * PENDING_VERIFICATION to ISSUED. Deliberately a separate endpoint from
 * POST /api/passports (creation) and a separate actor from the
 * manufacturer who submitted it — see RBAC note in the enterprise spec.
 *
 * Guardrails before issuing:
 *   1. Re-runs the same integrity check the public page uses. A passport
 *      whose stored data no longer matches its recordHash (e.g. tampered
 *      via a direct DB edit between submission and review) cannot be
 *      issued — the auditor would otherwise be signing off on data they
 *      never actually saw.
 *   2. Rejects passports that are already ISSUED or REVOKED — issuance
 *      is a one-way transition per batch; corrections go through a new
 *      passport version (previousRecordHash chain), not a re-issue.
 *
 * Does NOT touch recordHash. Issuance is an approval of already-hashed
 * data, not a data change — the hash represents the claim, the status
 * represents whether that claim has been signed off on.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVerifiedPassport } from "@/lib/verifyPassport";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  // TODO(auth): replace this with a real session check once auth is wired —
  // e.g. `if (session.role !== "AUDITOR" && session.role !== "CERTIFIER") return 403`.
  // Accepting an auditor identifier in the body is a placeholder for that.
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const auditorId = typeof body.auditorId === "string" && body.auditorId.trim() ? body.auditorId.trim() : null;
  if (!auditorId) {
    return NextResponse.json({ error: "auditorId is required (placeholder until session auth is wired)" }, { status: 400 });
  }

  const batchId = decodeURIComponent(params.batchId);
  const result = await getVerifiedPassport(batchId);

  if (!result) {
    return NextResponse.json({ error: `No passport found for batchId "${batchId}"` }, { status: 404 });
  }
  const { passport, integrityVerified } = result;

  if (passport.status === "ISSUED") {
    return NextResponse.json({ error: "Passport is already issued" }, { status: 409 });
  }
  if (passport.status === "REVOKED") {
    return NextResponse.json({ error: "Cannot issue a revoked passport — create a new version instead" }, { status: 409 });
  }
  if (!integrityVerified) {
    return NextResponse.json(
      { error: "Integrity check failed — stored data no longer matches recordHash. Cannot issue." },
      { status: 422 }
    );
  }

  const issued = await prisma.polymerPassport.update({
    where: { batchId },
    data: {
      status: "ISSUED",
      signedAt: new Date(),
      signedBy: auditorId,
    },
    include: { certifications: true, manufacturer: true },
  });

  return NextResponse.json(issued);
}
