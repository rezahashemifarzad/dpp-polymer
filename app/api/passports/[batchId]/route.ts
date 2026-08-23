/**
 * app/api/passports/[batchId]/route.ts
 * -----------------------------------------------------------------------
 * GET   /api/passports/{batchId}  — single-passport lookup. Powers both
 *                                    the consumer-facing QR scan view and
 *                                    the B2B dashboard detail panel.
 * PATCH /api/passports/{batchId}  — status transition (verify / revoke /
 *                                    supersede), gated to AUDITOR/ADMIN
 *                                    via lib/rbac.ts. Re-seals the record
 *                                    hash and writes an audit log entry.
 *
 * Params are awaited per Next.js 16 App Router conventions (dynamic route
 * params are async in this Next.js version — see AGENTS.md).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authorize, unauthorizedResponse } from "@/lib/rbac";
import { getPassportCertificationAlert } from "@/lib/utils/certification-status";
import {
  transitionPassportStatus,
  PassportNotFoundError,
  InvalidTransitionError,
} from "@/lib/services/transition-passport-status";

// STEP: the transition core (ALLOWED_TRANSITIONS, the hash re-chain, the
// update + audit-log write, all inside one $transaction) was extracted to
// lib/services/transition-passport-status.ts so the Third-Party Auditor
// Verification Workflow's submit-auditor-verification service could reuse
// it instead of forking a second copy. This route's behavior is
// unchanged — see that module's file banner for the full rationale.

const ACTION_BY_STATUS: Record<"ISSUED" | "REVOKED" | "SUPERSEDED", AuditAction> = {
  ISSUED: "VERIFIED",
  REVOKED: "REVOKED",
  SUPERSEDED: "SUPERSEDED",
};

const PatchSchema = z.object({
  status: z.enum(["ISSUED", "REVOKED", "SUPERSEDED"]),
  reason: z.string().max(500).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;

  try {
    const passport = await prisma.polymerPassport.findUnique({
      where: { batchId },
      include: {
        certifications: true,
        manufacturer: true,
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
      },
    });

    if (!passport) {
      return NextResponse.json(
        { success: false, error: `No passport found for batch "${batchId}"` },
        { status: 404 }
      );
    }

    // Compliance Expiry Alerts (docs/CIRCULAR_ECONOMY_PLATFORM_UPGRADE_SPEC.md
    // §2.4) — same computed-not-stored alert as the list route, for the
    // admin detail view.
    return NextResponse.json({
      success: true,
      data: { ...passport, certificationAlert: getPassportCertificationAlert(passport.certifications) },
    });
  } catch (error) {
    console.error(`GET /api/passports/${batchId} failed:`, error);
    return NextResponse.json({ success: false, error: "Failed to load passport" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;

  const role = authorize(req, ["AUDITOR", "ADMIN"]);
  if (!role) {
    return unauthorizedResponse();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { status: nextStatus, reason } = parsed.data;

  try {
    const updated = await prisma.$transaction((tx) =>
      transitionPassportStatus(tx, {
        batchId,
        nextStatus,
        actor: role,
        auditAction: ACTION_BY_STATUS[nextStatus],
        metadata: reason ? { reason } : undefined,
      })
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof PassportNotFoundError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    if (error instanceof InvalidTransitionError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    console.error(`PATCH /api/passports/${batchId} failed:`, error);
    return NextResponse.json({ success: false, error: "Failed to update passport status" }, { status: 500 });
  }
}
