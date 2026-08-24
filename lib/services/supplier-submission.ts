/**
 * lib/services/supplier-submission.ts
 * -----------------------------------------------------------------------
 * Phase 4 - Step 2: Supplier Onboarding Portal — the business-logic layer
 * behind SupplierInvite (a standing, reusable per-supplier credential) and
 * SupplierSubmission (one row per proposed batch), matching this app's
 * established "service functions, thin route/action wrappers" convention
 * (see lib/services/create-passport.ts, lib/services/expiry-alert-service.ts).
 *
 * Five operations:
 *   - createSupplierInvite   — admin provisions a new supplier link
 *   - listSupplierInvites    — admin's invite management list
 *   - revokeSupplierInvite   — admin soft-revokes a link (active: false)
 *   - submitSupplierSubmission — public: a supplier proposes a batch
 *   - listSupplierSubmissions  — admin's review queue
 *   - approveSupplierSubmission — admin: proposal -> real PolymerPassport
 *   - rejectSupplierSubmission  — admin: proposal declined, with feedback
 *
 * approveSupplierSubmission is the one operation with real complexity: it
 * assembles a PolymerPassportInputSchema-shaped payload from the
 * submission and calls the existing, canonical
 * lib/services/create-passport.ts's createPassport() — never a second
 * copy of that logic (this repo has already been bitten once by exactly
 * that kind of drift; see create-passport.ts's own file banner).
 * AuditLog integration happens ONLY here, at the moment of approval, via
 * the new SUPPLIER_SUBMISSION_APPROVED action — every earlier event
 * (invite created, submission received, submission rejected) has no
 * PolymerPassport row yet to attach a log entry to (writeAuditLog()
 * requires a non-nullable passportId), so those are tracked on the models'
 * own fields instead (invitedBy/invitedAt, reviewedBy/reviewedAt/
 * reviewNotes/status).
 */

import { randomBytes } from "crypto";
import type { SupplierInvite, SupplierSubmission, SupplierSubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { hashSupplierToken } from "@/lib/supplier-invite-auth";
import { SupplierSubmissionInputSchema } from "@/lib/types";
import { createPassport, type CreatePassportResult } from "@/lib/services/create-passport";

type ZodFlatten = { formErrors: string[]; fieldErrors: Record<string, string[]> };

const DEFAULT_BASE_URL = "http://localhost:3000";

/** Mirrors lib/qr.ts's own NEXT_PUBLIC_BASE_URL + fallback convention. */
function buildSupplierSubmitUrl(rawToken: string): string {
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  return `${baseUrl}/supplier/submit/${rawToken}`;
}

// ----------------------------------------------------------------------------
// SupplierInvite
// ----------------------------------------------------------------------------

export interface CreateSupplierInviteInput {
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  country: string;
  expiresAt?: Date;
}

export type CreateSupplierInviteResult =
  | { ok: true; status: 201; data: { invite: SupplierInvite; rawToken: string; submitUrl: string } }
  | { ok: false; status: 400; error: string };

/**
 * Creates a new SupplierInvite and returns its raw token EXACTLY ONCE —
 * same "raw secret shown once, only its hash persisted" convention as
 * scripts/create-auditor.ts. The caller (Server Action or REST route) is
 * responsible for surfacing rawToken/submitUrl to the admin; neither is
 * recoverable from the database afterward.
 */
export async function createSupplierInvite(
  input: CreateSupplierInviteInput,
  actor: string
): Promise<CreateSupplierInviteResult> {
  const companyName = input.companyName?.trim();
  const contactName = input.contactName?.trim();
  const contactEmail = input.contactEmail?.trim();
  const country = input.country?.trim();

  if (!companyName || !contactName || !contactEmail || !country) {
    return { ok: false, status: 400, error: "companyName, contactName, contactEmail and country are required" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { ok: false, status: 400, error: "contactEmail must be a valid email address" };
  }

  // 32 random bytes = 256 bits of entropy, hex-encoded — same generation
  // convention as scripts/create-auditor.ts's generateRawKey().
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashSupplierToken(rawToken);

  const invite = await prisma.supplierInvite.create({
    data: {
      companyName,
      contactName,
      contactEmail,
      contactPhone: input.contactPhone?.trim() || undefined,
      country,
      tokenHash,
      invitedBy: actor,
      expiresAt: input.expiresAt ?? null,
    },
  });

  return {
    ok: true,
    status: 201,
    data: { invite, rawToken, submitUrl: buildSupplierSubmitUrl(rawToken) },
  };
}

export async function listSupplierInvites() {
  return prisma.supplierInvite.findMany({
    orderBy: { invitedAt: "desc" },
    include: { _count: { select: { submissions: true } } },
  });
}

export type RevokeSupplierInviteResult =
  | { ok: true; status: 200; data: SupplierInvite }
  | { ok: false; status: 404; error: string };

export async function revokeSupplierInvite(inviteId: string): Promise<RevokeSupplierInviteResult> {
  const invite = await prisma.supplierInvite.findUnique({ where: { id: inviteId } });
  if (!invite) {
    return { ok: false, status: 404, error: `Supplier invite ${inviteId} not found` };
  }
  const updated = await prisma.supplierInvite.update({ where: { id: inviteId }, data: { active: false } });
  return { ok: true, status: 200, data: updated };
}

// ----------------------------------------------------------------------------
// SupplierSubmission — public intake
// ----------------------------------------------------------------------------

export type SubmitSupplierSubmissionResult =
  | { ok: true; status: 201; data: SupplierSubmission }
  | { ok: false; status: 400; error: string; issues?: ZodFlatten };

/**
 * Records a supplier's proposed batch against an already-resolved,
 * already-validated-active `invite` (see lib/supplier-invite-auth.ts's
 * resolveSupplierInvite — callers must resolve the invite themselves
 * before calling this, exactly like every RBAC-gated write route in this
 * app resolves its actor before calling the service layer).
 */
export async function submitSupplierSubmission(
  invite: SupplierInvite,
  rawInput: unknown
): Promise<SubmitSupplierSubmissionResult> {
  const parsed = SupplierSubmissionInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Validation failed", issues: parsed.error.flatten() };
  }
  const data = parsed.data;

  const submission = await prisma.supplierSubmission.create({
    data: {
      inviteId: invite.id,
      polymerType: data.polymerType,
      grade: data.grade,
      meltFlowIndex: data.meltFlowIndex,
      density: data.density,
      proposedGtin: data.proposedGtin,
      proposedBatchId: data.proposedBatchId,
      recycledContentSource: data.recycledContentSource,
      recycledContentPercent: data.recycledContentPercent,
      bioBasedPercent: data.bioBasedPercent,
      carbonFootprintKgCO2ePerKg: data.carbonFootprintKgCO2ePerKg,
      weightKg: data.weightKg,
      certScheme: data.certScheme,
      certificateId: data.certificateId,
      issuingBody: data.issuingBody,
      certValidFrom: data.certValidFrom,
      certValidUntil: data.certValidUntil,
      certDocumentUrl: data.certDocumentUrl,
      certDocumentHash: data.certDocumentHash,
      supplierNotes: data.supplierNotes,
      status: "PENDING",
    },
  });

  return { ok: true, status: 201, data: submission };
}

// ----------------------------------------------------------------------------
// SupplierSubmission — admin review queue
// ----------------------------------------------------------------------------

export async function listSupplierSubmissions(status?: SupplierSubmissionStatus) {
  return prisma.supplierSubmission.findMany({
    where: status ? { status } : undefined,
    include: { invite: true },
    orderBy: { submittedAt: "desc" },
  });
}

export interface ApproveSupplierSubmissionOverrides {
  gtin?: string;
  batchId?: string;
  meltFlowIndex?: number;
  density?: number;
  manufacturerId?: string;
}

type PassportResult = Extract<CreatePassportResult, { ok: true }>["data"];

export type ApproveSupplierSubmissionResult =
  | { ok: true; status: 201; data: { passport: PassportResult; submission: SupplierSubmission } }
  | { ok: false; status: 400 | 404 | 409; error: string; issues?: ZodFlatten };

/**
 * Converts a PENDING SupplierSubmission into a real PolymerPassport.
 * Deliberately does NOT invent its own manufacturer/GTIN/batchId/cert
 * validation — it fills in what PolymerPassportInputSchema requires that
 * the submission itself couldn't reliably supply (see
 * SupplierSubmissionInputSchema's own file comment in lib/types.ts) via
 * `overrides`, then hands off to createPassport(), which enforces every
 * real rule (GTIN check digit, batchId uniqueness, manufacturer
 * existence) exactly as it does for every other passport-creation path in
 * this app. A validation failure there comes back through unchanged, so
 * the admin sees the SAME error a manufacturer would from POST
 * /api/passports — never a second, drifted copy of that error surface.
 */
export async function approveSupplierSubmission(
  submissionId: string,
  actor: string,
  overrides: ApproveSupplierSubmissionOverrides = {}
): Promise<ApproveSupplierSubmissionResult> {
  const submission = await prisma.supplierSubmission.findUnique({
    where: { id: submissionId },
    include: { invite: true },
  });
  if (!submission) {
    return { ok: false, status: 404, error: `Supplier submission ${submissionId} not found` };
  }
  if (submission.status !== "PENDING") {
    return { ok: false, status: 409, error: `This submission has already been ${submission.status.toLowerCase()}` };
  }

  const meltFlowIndex = overrides.meltFlowIndex ?? (submission.meltFlowIndex ? Number(submission.meltFlowIndex) : undefined);
  const density = overrides.density ?? (submission.density ? Number(submission.density) : undefined);
  if (meltFlowIndex === undefined || density === undefined) {
    return {
      ok: false,
      status: 400,
      error:
        "meltFlowIndex and density are required to issue a passport, and this submission didn't include both — supply them as overrides before approving.",
    };
  }

  if (!submission.certScheme || !submission.certificateId || !submission.issuingBody || !submission.certValidFrom || !submission.certValidUntil) {
    return {
      ok: false,
      status: 400,
      error:
        "This submission has no complete certification on file (scheme, certificate ID, issuing body, and validity dates are all required) — request the supplier provide certification details before approving.",
    };
  }

  // --- Resolve (or create) the Manufacturer row for this supplier ---------
  // Cached on the invite after the first approval so every later approval
  // from the same supplier reuses the same row instead of creating a
  // duplicate Manufacturer per batch.
  let manufacturerId = overrides.manufacturerId ?? submission.invite.manufacturerId ?? undefined;
  if (!manufacturerId) {
    const existing = await prisma.manufacturer.findFirst({
      where: {
        legalName: { equals: submission.invite.companyName, mode: "insensitive" },
        country: submission.invite.country,
      },
      select: { id: true },
    });
    if (existing) {
      manufacturerId = existing.id;
    } else {
      const created = await prisma.manufacturer.create({
        data: { legalName: submission.invite.companyName, country: submission.invite.country },
        select: { id: true },
      });
      manufacturerId = created.id;
    }
    await prisma.supplierInvite.update({ where: { id: submission.invite.id }, data: { manufacturerId } });
  }

  const gtin = overrides.gtin ?? submission.proposedGtin ?? undefined;
  const batchId = overrides.batchId ?? submission.proposedBatchId ?? `SUPPLIER-${submission.id.slice(0, 8).toUpperCase()}`;

  if (!gtin) {
    return {
      ok: false,
      status: 400,
      error:
        "A valid 14-digit GTIN is required to issue a passport, and this submission didn't include one — supply gtin as an override before approving.",
    };
  }

  const recycledContentPercent = Number(submission.recycledContentPercent);

  const passportInput = {
    polymerType: submission.polymerType,
    grade: submission.grade,
    meltFlowIndex,
    density,
    gtin,
    recycledContentSource: submission.recycledContentSource ?? undefined,
    recycledContentPercent,
    // The only certification on file for this submission is also the most
    // reasonable default for "the scheme backing the recycled-content
    // claim" — an admin who needs a different scheme for that specific
    // claim can still edit the resulting passport's certifications after
    // approval through the existing certificate management flow.
    recycledContentCertScheme: recycledContentPercent > 0 ? submission.certScheme : undefined,
    bioBasedPercent: Number(submission.bioBasedPercent),
    carbonFootprintKgCO2ePerKg: Number(submission.carbonFootprintKgCO2ePerKg),
    batchId,
    manufacturerId,
    certifications: [
      {
        scheme: submission.certScheme,
        certificateId: submission.certificateId,
        issuingBody: submission.issuingBody,
        validFrom: submission.certValidFrom,
        validUntil: submission.certValidUntil,
        documentUrl: submission.certDocumentUrl ?? undefined,
        documentHash: submission.certDocumentHash ?? undefined,
      },
    ],
  };

  const result = await createPassport(passportInput);
  if (!result.ok) {
    return result;
  }

  const updatedSubmission = await prisma.$transaction(async (tx) => {
    const savedSubmission = await tx.supplierSubmission.update({
      where: { id: submission.id },
      data: {
        status: "APPROVED",
        reviewedBy: actor,
        reviewedAt: new Date(),
        resultingPassportId: result.data.id,
      },
    });

    await writeAuditLog(tx, {
      passportId: result.data.id,
      action: "SUPPLIER_SUBMISSION_APPROVED",
      actor,
      previousHash: null,
      newHash: result.data.recordHash,
      metadata: {
        supplierSubmissionId: submission.id,
        supplierInviteId: submission.invite.id,
        supplierCompany: submission.invite.companyName,
      },
    });

    return savedSubmission;
  });

  return {
    ok: true,
    status: 201,
    data: { passport: result.data, submission: updatedSubmission },
  };
}

export type RejectSupplierSubmissionResult =
  | { ok: true; status: 200; data: SupplierSubmission }
  | { ok: false; status: 400 | 404 | 409; error: string };

export async function rejectSupplierSubmission(
  submissionId: string,
  actor: string,
  reviewNotes: string
): Promise<RejectSupplierSubmissionResult> {
  const submission = await prisma.supplierSubmission.findUnique({ where: { id: submissionId } });
  if (!submission) {
    return { ok: false, status: 404, error: `Supplier submission ${submissionId} not found` };
  }
  if (submission.status !== "PENDING") {
    return { ok: false, status: 409, error: `This submission has already been ${submission.status.toLowerCase()}` };
  }
  if (!reviewNotes?.trim()) {
    return { ok: false, status: 400, error: "reviewNotes is required when rejecting a submission" };
  }

  // No AuditLog entry — deliberately. No PolymerPassport exists for a
  // rejected submission (writeAuditLog() requires a non-nullable
  // passportId), so the rejection's full record lives on this row itself
  // (status/reviewedBy/reviewedAt/reviewNotes), same as every other
  // pre-approval event in this feature.
  const updated = await prisma.supplierSubmission.update({
    where: { id: submissionId },
    data: {
      status: "REJECTED",
      reviewedBy: actor,
      reviewedAt: new Date(),
      reviewNotes: reviewNotes.trim(),
    },
  });

  return { ok: true, status: 200, data: updated };
}
