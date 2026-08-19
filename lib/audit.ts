/**
 * lib/audit.ts
 * -----------------------------------------------------------------------
 * Writes an immutable AuditLog row for every state-changing passport
 * action (issued, verified, revoked, superseded). Always call this inside
 * the same $transaction as the mutation it's recording, so the passport
 * write and its audit trail entry commit — or roll back — together.
 */

import { Prisma, PrismaClient, AuditAction } from "@prisma/client";

type TxClient = Prisma.TransactionClient | PrismaClient;

export interface WriteAuditLogParams {
  passportId: string;
  action: AuditAction;
  actor: string;
  previousHash: string | null;
  newHash: string | null;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(client: TxClient, params: WriteAuditLogParams) {
  return client.auditLog.create({
    data: {
      passportId: params.passportId,
      action: params.action,
      actor: params.actor,
      previousHash: params.previousHash,
      newHash: params.newHash,
      metadata:
        params.metadata !== undefined
          ? (params.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
    },
  });
}
