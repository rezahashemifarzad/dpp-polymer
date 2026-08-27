/**
 * lib/services/account-audit-log.ts
 * -----------------------------------------------------------------------
 * Writes an AccountAuditLog row for an Auditor/Client account-lifecycle
 * event (created, activated, deactivated, API key rotated, password
 * set/reset). See prisma/schema.prisma's AccountAuditLog comment for why
 * this is a separate, non-hash-chained table from lib/audit.ts's
 * writeAuditLog (the passport-scoped, hash-chained compliance ledger)
 * rather than an extension of it — an account event has no passportId to
 * attach to, and doesn't need that ledger's tamper-evidence machinery.
 *
 * Always call inside the same $transaction as the account mutation it
 * records, same convention as writeAuditLog, so the two can never commit
 * out of sync with each other.
 */

import { Prisma, PrismaClient, AccountAuditAction, SessionActorType } from "@prisma/client";

type TxClient = Prisma.TransactionClient | PrismaClient;

export interface WriteAccountAuditLogParams {
  targetType: SessionActorType;
  targetId: string;
  action: AccountAuditAction;
  actor: string;
  metadata?: Record<string, unknown>;
}

export async function writeAccountAuditLog(client: TxClient, params: WriteAccountAuditLogParams) {
  return client.accountAuditLog.create({
    data: {
      targetType: params.targetType,
      targetId: params.targetId,
      action: params.action,
      actor: params.actor,
      metadata:
        params.metadata !== undefined
          ? (JSON.parse(JSON.stringify(params.metadata)) as Prisma.InputJsonValue)
          : Prisma.JsonNull,
    },
  });
}
