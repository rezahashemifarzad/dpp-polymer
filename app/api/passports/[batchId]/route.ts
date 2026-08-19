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
import { DppStatus, AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashRecord } from "@/lib/types";
import { writeAuditLog } from "@/lib/audit";
import { authorize, unauthorizedResponse } from "@/lib/rbac";

const ALLOWED_TRANSITIONS: Record<DppStatus, DppStatus[]> = {
  DRAFT: ["PENDING_VERIFICATION", "REVOKED"],
  PENDING_VERIFICATION: ["ISSUED", "REVOKED"],
  ISSUED: ["REVOKED", "SUPERSEDED"],
  REVOKED: [],
  SUPERSEDED: [],
};

const ACTION_BY_STATUS: Record<"ISSUED" | "REVOKED" | "SUPERSEDED", AuditAction> = {
  ISSUED: "VERIFIED",
  REVOKED: "REVOKED",
  SUPERSEDED: "SUPERSEDED",
};

const PatchSchema = z.object({
  status: z.enum(["ISSUED", "REVOKED", "SUPERSEDED"]),
  reason: z.string().max(500).optional(),
});

class PassportNotFoundError extends Error {
  constructor(batchId: string) {
    super(`No passport found for batch "${batchId}"`);
    this.name = "PassportNotFoundError";
  }
}

class InvalidTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot transition passport from "${from}" to "${to}"`);
    this.name = "InvalidTransitionError";
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
      include: { certifications: true, manufacturer: true },
    });

    if (!passport) {
      return NextResponse.json(
        { success: false, error: `No passport found for batch "${batchId}"` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: passport });
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
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.polymerPassport.findUnique({ where: { batchId } });
      if (!current) {
        throw new PassportNotFoundError(batchId);
      }

      const allowed = ALLOWED_TRANSITIONS[current.status];
      if (!allowed.includes(nextStatus)) {
        throw new InvalidTransitionError(current.status, nextStatus);
      }

      const newHash = hashRecord({
        batchId: current.batchId,
        gtin: current.gtin,
        status: nextStatus,
        previousRecordHash: current.recordHash,
        transitionedAt: new Date(),
      });

      const passport = await tx.polymerPassport.update({
        where: { batchId },
        data: {
          status: nextStatus,
          previousRecordHash: current.recordHash,
          recordHash: newHash,
          signedAt: new Date(),
          signedBy: role,
        },
        include: { certifications: true, manufacturer: true },
      });

      await writeAuditLog(tx, {
        passportId: passport.id,
        action: ACTION_BY_STATUS[nextStatus],
        actor: role,
        previousHash: current.recordHash,
        newHash,
        metadata: reason ? { reason } : undefined,
      });

      return passport;
    });

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
