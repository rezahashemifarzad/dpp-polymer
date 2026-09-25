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
 *
 * Wrapped in wrapSchemaDrift(): AccountAuditLog was added in the same
 * sprint as the Admin UI for Auditor & Buyer Accounts, and this project
 * has no migration history (see lib/services/schema-drift.ts's file
 * banner) — a database this table's `db push` was never run against
 * throws Prisma P2021 here, which previously surfaced to the admin
 * console as an opaque "Failed to create auditor account"-style error
 * with no indication of the real cause (see
 * claude/production-readiness-deployment-checklist-notes.md-style
 * "/admin/accounts is non-functional" report this fixes).
 */

import { Prisma, PrismaClient, AccountAuditAction, SessionActorType } from "@prisma/client";
import { wrapSchemaDrift } from "@/lib/services/schema-drift";

type TxClient = Prisma.TransactionClient | PrismaClient;

export interface WriteAccountAuditLogParams {
  targetType: SessionActorType;
  targetId: string;
  action: AccountAuditAction;
  actor: string;
  metadata?: Record<string, unknown>;
}

export async function writeAccountAuditLog(client: TxClient, params: WriteAccountAuditLogParams) {
  return wrapSchemaDrift(() =>
    client.accountAuditLog.create({
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
    })
  );
}
