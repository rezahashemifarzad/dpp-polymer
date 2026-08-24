/**
 * app/api/auditor/coc-queue/route.ts
 * -----------------------------------------------------------------------
 * GET /api/auditor/coc-queue — every Chain-of-Custody tier record
 * currently PENDING_REVIEW, across all passports, with enough passport
 * context (batchId, polymerType, grade, manufacturer) for a reviewer to
 * actually place the tier record in context. Mirrors
 * app/api/auditor/queue/route.ts's shape and auth exactly, but the queue
 * itself is a different concept — that route lists whole PASSPORTS
 * awaiting the top-level PENDING_VERIFICATION sign-off; this one lists
 * individual TIER RECORDS awaiting their own, narrower review, which can
 * happen at any point in a passport's own lifecycle.
 *
 * Gated by lib/auditor-auth.ts's authorizeAuditor() — same reasoning as
 * the whole-passport queue: "who can see the queue" and "who can sign as
 * themselves" must be the same identity check. Also intentionally NOT
 * auditor-specific — first-review-wins, no per-auditor assignment concept
 * in this MVP.
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
    const records = await prisma.chainOfCustodyRecord.findMany({
      where: { status: "PENDING_REVIEW" },
      include: {
        passport: {
          select: {
            id: true,
            batchId: true,
            polymerType: true,
            grade: true,
            gtin: true,
            manufacturer: { select: { id: true, legalName: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" }, // oldest-awaiting-review first
    });

    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    console.error("GET /api/auditor/coc-queue failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load chain-of-custody review queue" },
      { status: 500 }
    );
  }
}
