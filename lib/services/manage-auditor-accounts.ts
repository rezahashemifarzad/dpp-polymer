/**
 * lib/services/manage-auditor-accounts.ts
 * -----------------------------------------------------------------------
 * Admin UI for Auditor & Buyer Accounts — the provisioning/management
 * operations for Auditor rows that previously only existed as CLI scripts
 * (scripts/create-auditor.ts, scripts/set-auditor-password.ts). Those
 * scripts are untouched and still work standalone; this is the same
 * capability reachable from the admin console instead of a developer's
 * terminal.
 *
 * Reuses lib/auditor-auth.ts's hashAuditorKey and lib/password.ts's
 * hashPassword directly (not duplicated the way the CLI scripts
 * duplicate the hash function) — this module runs inside the Next.js
 * server context, so the "@/" path alias and lib/prisma's app-configured
 * client are both available here, unlike a standalone `tsx` script. See
 * scripts/create-auditor.ts's own comment for why IT duplicates instead.
 *
 * Every mutation here writes an AccountAuditLog row in the same
 * transaction — see lib/services/account-audit-log.ts's file banner for
 * why that's a separate table from the passport-scoped AuditLog.
 */

import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CreateAuditorAccountInputSchema, SetAccountPasswordInputSchema } from "@/lib/types";
import { hashAuditorKey } from "@/lib/auditor-auth";
import { hashPassword } from "@/lib/password";
import { writeAccountAuditLog } from "@/lib/services/account-audit-log";

type ZodFlatten = { formErrors: string[]; fieldErrors: Record<string, string[]> };

export interface AuditorAccountRow {
  id: string;
  name: string;
  organization: string;
  email: string | null;
  active: boolean;
  hasPassword: boolean;
  createdAt: Date;
}

function toRow(a: {
  id: string;
  name: string;
  organization: string;
  email: string | null;
  active: boolean;
  passwordHash: string | null;
  createdAt: Date;
}): AuditorAccountRow {
  return {
    id: a.id,
    name: a.name,
    organization: a.organization,
    email: a.email,
    active: a.active,
    hasPassword: a.passwordHash !== null,
    createdAt: a.createdAt,
  };
}

function generateRawKey(): string {
  // 32 random bytes = 256 bits, hex-encoded — same convention as
  // scripts/create-auditor.ts's generateRawKey.
  return randomBytes(32).toString("hex");
}

export async function listAuditorAccounts(): Promise<AuditorAccountRow[]> {
  const auditors = await prisma.auditor.findMany({ orderBy: { createdAt: "desc" } });
  return auditors.map(toRow);
}

export type CreateAuditorAccountResult =
  | { ok: true; status: 201; data: { auditor: AuditorAccountRow; rawApiKey: string } }
  | { ok: false; status: 400; error: string; issues?: ZodFlatten }
  | { ok: false; status: 409; error: string };

export async function createAuditorAccount(rawInput: unknown, actor: string): Promise<CreateAuditorAccountResult> {
  const parsed = CreateAuditorAccountInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Validation failed", issues: parsed.error.flatten() };
  }
  const { name, organization, email, password } = parsed.data;

  const rawApiKey = generateRawKey();
  const apiKeyHash = hashAuditorKey(rawApiKey);
  const passwordHash = password ? await hashPassword(password) : undefined;

  try {
    const auditor = await prisma.$transaction(async (tx) => {
      const created = await tx.auditor.create({
        data: { name, organization, email, apiKeyHash, active: true, passwordHash },
      });
      await writeAccountAuditLog(tx, {
        targetType: "AUDITOR",
        targetId: created.id,
        action: "ACCOUNT_CREATED",
        actor,
        metadata: { name, organization, email: email ?? null, passwordSet: Boolean(passwordHash) },
      });
      return created;
    });

    return { ok: true, status: 201, data: { auditor: toRow(auditor), rawApiKey } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, status: 409, error: "An auditor with this email already exists" };
    }
    throw error;
  }
}

export type SetAuditorActiveResult =
  | { ok: true; status: 200; data: AuditorAccountRow }
  | { ok: false; status: 404; error: string };

export async function setAuditorActive(id: string, active: boolean, actor: string): Promise<SetAuditorActiveResult> {
  const existing = await prisma.auditor.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, status: 404, error: `No auditor found for id "${id}"` };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.auditor.update({ where: { id }, data: { active } });
    await writeAccountAuditLog(tx, {
      targetType: "AUDITOR",
      targetId: id,
      action: active ? "ACCOUNT_ACTIVATED" : "ACCOUNT_DEACTIVATED",
      actor,
    });
    return u;
  });

  return { ok: true, status: 200, data: toRow(updated) };
}

export type RotateAuditorApiKeyResult =
  | { ok: true; status: 200; data: { auditor: AuditorAccountRow; rawApiKey: string } }
  | { ok: false; status: 404; error: string };

export async function rotateAuditorApiKey(id: string, actor: string): Promise<RotateAuditorApiKeyResult> {
  const existing = await prisma.auditor.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, status: 404, error: `No auditor found for id "${id}"` };
  }

  const rawApiKey = generateRawKey();
  const apiKeyHash = hashAuditorKey(rawApiKey);

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.auditor.update({ where: { id }, data: { apiKeyHash } });
    await writeAccountAuditLog(tx, { targetType: "AUDITOR", targetId: id, action: "API_KEY_ROTATED", actor });
    return u;
  });

  return { ok: true, status: 200, data: { auditor: toRow(updated), rawApiKey } };
}

export type SetAuditorPasswordResult =
  | { ok: true; status: 200; data: AuditorAccountRow }
  | { ok: false; status: 400; error: string; issues?: ZodFlatten }
  | { ok: false; status: 404; error: string };

export async function setAuditorPassword(
  id: string,
  rawInput: unknown,
  actor: string
): Promise<SetAuditorPasswordResult> {
  const parsed = SetAccountPasswordInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Validation failed", issues: parsed.error.flatten() };
  }

  const existing = await prisma.auditor.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, status: 404, error: `No auditor found for id "${id}"` };
  }
  if (!existing.email) {
    return {
      ok: false,
      status: 400,
      error: "This auditor has no email on file — /login signs in by email, so add one before setting a password.",
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.auditor.update({ where: { id }, data: { passwordHash } });
    await writeAccountAuditLog(tx, { targetType: "AUDITOR", targetId: id, action: "PASSWORD_SET", actor });
    return u;
  });

  return { ok: true, status: 200, data: toRow(updated) };
}
