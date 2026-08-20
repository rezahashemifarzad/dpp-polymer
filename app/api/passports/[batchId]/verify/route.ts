/**
 * app/api/passports/[batchId]/verify/route.ts
 * -----------------------------------------------------------------------
 * PATCH /api/passports/:batchId/verify
 *
 * The Auditor/Certifier-role action that flips a passport from
 * PENDING_VERIFICATION to ISSUED. This existed previously as a stray
 * "route.ts.ts" file (double extension) — Next.js's router ignored it by
 * filename so it was never actually reachable, but tsconfig.json's
 * `**\/*.ts` include pattern still matched it, so `next build`'s
 * TypeScript pass compiled it anyway. It used the pre-Next-16 synchronous
 * `{ params: { batchId: string } }` shape instead of the required
 * `{ params: Promise<{ batchId: string }> }` — a real, buildable type
 * error sitting in a file nothing ever routed to. Fixed below: params is
 * now awaited like every other route handler in this app.
 *
 * NOTE: app/api/passports/[batchId]/route.ts's PATCH handler already
 * covers the PENDING_VERIFICATION -> ISSUED transition (plus REVOKED and
 * SUPERSEDED) with full RBAC, hash re-chaining, and audit logging. This
 * endpoint is narrower and still uses a placeholder auditorId-in-body
 * check instead of real RBAC — kept as-is functionally, only the params
 * type is fixed, since expanding its behavior wasn't asked for here. If
 * you don't have a UI calling POST/PATCH .../verify specifically, the
 * [batchId]/route.ts PATCH endpoint is the one actually wired to
 * anything today, and this one may be safe to delete entirely.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVerifiedPassport } from "@/lib/verifyPassport";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId: rawBatchId } = await params;

  // TODO(auth): replace this with a real session check once auth is wired —
  // e.g. `if (session.role !== "AUDITOR" && session.role !== "CERTIFIER") return 403`.
  // Accepting an auditor identifier in the body is a placeholder for that.
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const auditorId = typeof body.auditorId === "string" && body.auditorId.trim() ? body.auditorId.trim() : null;
  if (!auditorId) {
    return NextResponse.json({ error: "auditorId is required (placeholder until session auth is wired)" }, { status: 400 });
  }

  const batchId = decodeURIComponent(rawBatchId);
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
