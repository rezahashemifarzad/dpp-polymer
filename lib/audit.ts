/**
 * lib/audit.ts
 * -----------------------------------------------------------------------
 * Writes an immutable AuditLog row for every state-changing passport
 * action (issued, verified, revoked, superseded, supplier submissions
 * approved, expiry alerts raised/acknowledged, ...). Always call this
 * inside the same $transaction as the mutation it's recording, so the
 * passport write and its audit trail entry commit — or roll back —
 * together.
 *
 * Phase 4 - Step 3 (Immutable Audit Trail / Ledger Log): this is now also
 * the ONLY place a row's hash-chain fields (sequence, entryHash,
 * previousEntryHash) are computed — see prisma/schema.prisma's AuditLog
 * comment for the full design rationale. The public signature is
 * unchanged from before this step, so every existing call site (a dozen+
 * across lib/services/*.ts) keeps working without modification; the
 * chain bookkeeping is entirely internal to this function.
 */

import { Prisma, PrismaClient, AuditAction } from "@prisma/client";
import { hashRecord } from "@/lib/types";

type TxClient = Prisma.TransactionClient | PrismaClient;

export interface WriteAuditLogParams {
  passportId: string;
  action: AuditAction;
  actor: string;
  previousHash: string | null;
  newHash: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Normalizes metadata to plain JSON before it's either hashed or
 * persisted — the exact same "round-trip through JSON.stringify/parse"
 * technique this app's Server Actions already use (see e.g.
 * lib/actions/create-passport.ts's toPlainJson) to turn a Prisma.Decimal
 * or Date embedded in a metadata object into its plain string/number
 * form. Doing this BEFORE computing entryHash — rather than hashing the
 * live object, which may still hold class instances — guarantees the
 * hash is computed over literally the same plain-JSON value that ends up
 * stored in the JSONB column, so a later integrity check (which can only
 * ever read the already-normalized value back out of Postgres) recomputes
 * an identical hash. Hashing the pre-normalization object here would risk
 * a false "tampered" verdict on a row nobody touched.
 */
function normalizeMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (metadata === undefined) return null;
  return JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>;
}

export async function writeAuditLog(client: TxClient, params: WriteAuditLogParams) {
  const createdAt = new Date();
  const normalizedMetadata = normalizeMetadata(params.metadata);

  // sequence/previousEntryHash both come from whatever the current last
  // row in the ledger is. Deliberately computed here (application code),
  // not via a DB @default(autoincrement()) — entryHash has to be
  // computable BEFORE the INSERT, so every input to that hash, sequence
  // included, must already be known.
  //
  // Concurrency note: two writeAuditLog calls racing in truly concurrent,
  // still-uncommitted transactions could compute the same "next sequence"
  // value. sequence's @unique constraint (schema.prisma) makes that fail
  // safely rather than silently corrupt the chain — Postgres blocks the
  // second INSERT until the first transaction resolves, then either
  // errors (if the first committed) or succeeds (if it rolled back). That
  // is the correct behavior for a hash-chained ledger: a genuine race
  // should surface as a retryable write conflict, never as two rows
  // silently claiming the same link in the chain. This app's actual write
  // volume (an admin/compliance tool, not a high-throughput system) makes
  // that a rare, acceptable trade-off rather than a real bottleneck.
  const previous = await client.auditLog.findFirst({
    orderBy: { sequence: "desc" },
    select: { sequence: true, entryHash: true },
  });
  const sequence = (previous?.sequence ?? 0) + 1;
  const previousEntryHash = previous?.entryHash ?? null;

  const entryHash = hashRecord({
    sequence,
    passportId: params.passportId,
    action: params.action,
    actor: params.actor,
    previousHash: params.previousHash,
    newHash: params.newHash,
    metadata: normalizedMetadata,
    createdAt,
    previousEntryHash,
  });

  return client.auditLog.create({
    data: {
      sequence,
      passportId: params.passportId,
      action: params.action,
      actor: params.actor,
      previousHash: params.previousHash,
      newHash: params.newHash,
      metadata: normalizedMetadata !== null ? (normalizedMetadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      entryHash,
      previousEntryHash,
      createdAt,
    },
  });
}
