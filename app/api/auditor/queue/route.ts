/**
 * app/api/auditor/queue/route.ts
 * -----------------------------------------------------------------------
 * GET /api/auditor/queue — the authenticated Auditor's review queue: every
 * passport currently PENDING_VERIFICATION, with the certifications and
 * manufacturer data a reviewer needs to actually inspect the batch.
 *
 * Gated by lib/auditor-auth.ts's authorizeAuditor() (personal per-auditor
 * key via the `x-dpp-auditor-key` header) — deliberately NOT lib/rbac.ts's
 * shared-role-key authorize(), since "who is allowed to see the queue" and
 * "who is allowed to sign as themselves" must be the same identity check.
 *
 * The queue is intentionally NOT auditor-specific (every active auditor
 * sees the same shared PENDING_VERIFICATION queue, not a per-auditor
 * assignment) — there is no assignment/claiming concept in this MVP, so
 * first-review-wins; a second auditor opening an already-reviewed batch
 * will simply find its status has moved on.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeAuditor, auditorUnauthorizedResponse } from "@/lib/auditor-auth";

export async function GET(req: NextRequest) {
  const auditor = await authorizeAuditor(req);
  if (!auditor) {
    return auditorUnauthorizedResponse();
  }

  try {
    const passports = await prisma.polymerPassport.findMany({
      where: { status: "PENDING_VERIFICATION" },
      include: {
        certifications: true,
        manufacturer: true,
        carbonFootprintCalculation: true,
      },
      orderBy: { productionDate: "asc" }, // oldest-awaiting-review first
    });

    return NextResponse.json({ success: true, data: passports });
  } catch (error) {
    console.error("GET /api/auditor/queue failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load auditor review queue" },
      { status: 500 }
    );
  }
}
