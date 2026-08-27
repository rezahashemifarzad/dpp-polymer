/**
 * lib/services/manage-client-accounts.ts
 * -----------------------------------------------------------------------
 * Admin UI for Auditor & Buyer Accounts — the Client (buyer company) half.
 * Structurally identical to lib/services/manage-auditor-accounts.ts
 * (same operations, same result shapes) but deliberately a separate file
 * rather than a generic parameterized module — mirrors lib/client-auth.ts
 * vs lib/auditor-auth.ts's own "small duplication over premature
 * abstraction" precedent (see that file's banner for the full rationale):
 * these guard different tables with different field shapes (companyName/
 * country vs name/organization), and a third actor type is the trigger to
 * extract a shared helper, not before.
 */

import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CreateClientAccountInputSchema, SetAccountPasswordInputSchema } from "@/lib/types";
import { hashClientKey } from "@/lib/client-auth";
import { hashPassword } from "@/lib/password";
import { writeAccountAuditLog } from "@/lib/services/account-audit-log";

type ZodFlatten = { formErrors: string[]; fieldErrors: Record<string, string[]> };

export interface ClientAccountRow {
  id: string;
  companyName: string;
  country: string | null;
  contactEmail: string | null;
  active: boolean;
  hasPassword: boolean;
  createdAt: Date;
}

function toRow(c: {
  id: string;
  companyName: string;
  country: string | null;
  contactEmail: string | null;
  active: boolean;
  passwordHash: string | null;
  createdAt: Date;
}): ClientAccountRow {
  return {
    id: c.id,
    companyName: c.companyName,
    country: c.country,
    contactEmail: c.contactEmail,
    active: c.active,
    hasPassword: c.passwordHash !== null,
    createdAt: c.createdAt,
  };
}

function generateRawKey(): string {
  return randomBytes(32).toString("hex");
}

export async function listClientAccounts(): Promise<ClientAccountRow[]> {
  const clients = await prisma.client.findMany({ orderBy: { createdAt: "desc" } });
  return clients.map(toRow);
}

export type CreateClientAccountResult =
  | { ok: true; status: 201; data: { client: ClientAccountRow; rawApiKey: string } }
  | { ok: false; status: 400; error: string; issues?: ZodFlatten }
  | { ok: false; status: 409; error: string };

export async function createClientAccount(rawInput: unknown, actor: string): Promise<CreateClientAccountResult> {
  const parsed = CreateClientAccountInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Validation failed", issues: parsed.error.flatten() };
  }
  const { companyName, country, contactEmail, password } = parsed.data;

  const rawApiKey = generateRawKey();
  const apiKeyHash = hashClientKey(rawApiKey);
  const passwordHash = password ? await hashPassword(password) : undefined;

  try {
    const client = await prisma.$transaction(async (tx) => {
      const created = await tx.client.create({
        data: { companyName, country, contactEmail, apiKeyHash, active: true, passwordHash },
      });
      await writeAccountAuditLog(tx, {
        targetType: "CUSTOMER",
        targetId: created.id,
        action: "ACCOUNT_CREATED",
        actor,
        metadata: { companyName, country: country ?? null, contactEmail: contactEmail ?? null, passwordSet: Boolean(passwordHash) },
      });
      return created;
    });

    return { ok: true, status: 201, data: { client: toRow(client), rawApiKey } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, status: 409, error: "A client with this contact email already exists" };
    }
    throw error;
  }
}

export type SetClientActiveResult =
  | { ok: true; status: 200; data: ClientAccountRow }
  | { ok: false; status: 404; error: string };

export async function setClientActive(id: string, active: boolean, actor: string): Promise<SetClientActiveResult> {
  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, status: 404, error: `No client found for id "${id}"` };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.client.update({ where: { id }, data: { active } });
    await writeAccountAuditLog(tx, {
      targetType: "CUSTOMER",
      targetId: id,
      action: active ? "ACCOUNT_ACTIVATED" : "ACCOUNT_DEACTIVATED",
      actor,
    });
    return u;
  });

  return { ok: true, status: 200, data: toRow(updated) };
}

export type RotateClientApiKeyResult =
  | { ok: true; status: 200; data: { client: ClientAccountRow; rawApiKey: string } }
  | { ok: false; status: 404; error: string };

export async function rotateClientApiKey(id: string, actor: string): Promise<RotateClientApiKeyResult> {
  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, status: 404, error: `No client found for id "${id}"` };
  }

  const rawApiKey = generateRawKey();
  const apiKeyHash = hashClientKey(rawApiKey);

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.client.update({ where: { id }, data: { apiKeyHash } });
    await writeAccountAuditLog(tx, { targetType: "CUSTOMER", targetId: id, action: "API_KEY_ROTATED", actor });
    return u;
  });

  return { ok: true, status: 200, data: { client: toRow(updated), rawApiKey } };
}

export type SetClientPasswordResult =
  | { ok: true; status: 200; data: ClientAccountRow }
  | { ok: false; status: 400; error: string; issues?: ZodFlatten }
  | { ok: false; status: 404; error: string };

export async function setClientPassword(
  id: string,
  rawInput: unknown,
  actor: string
): Promise<SetClientPasswordResult> {
  const parsed = SetAccountPasswordInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Validation failed", issues: parsed.error.flatten() };
  }

  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, status: 404, error: `No client found for id "${id}"` };
  }
  if (!existing.contactEmail) {
    return {
      ok: false,
      status: 400,
      error: "This client has no contact email on file — /login signs in by email, so add one before setting a password.",
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.client.update({ where: { id }, data: { passwordHash } });
    await writeAccountAuditLog(tx, { targetType: "CUSTOMER", targetId: id, action: "PASSWORD_SET", actor });
    return u;
  });

  return { ok: true, status: 200, data: toRow(updated) };
}
