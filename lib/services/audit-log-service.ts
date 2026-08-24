/**
 * lib/services/audit-log-service.ts
 * -----------------------------------------------------------------------
 * Phase 4 - Step 3: Immutable Audit Trail / Ledger Log — the read-side
 * service layer behind /admin/audit: filtered/paginated listing, filter
 * option discovery, and the hash-chain integrity verifier. Nothing in
 * this file writes to AuditLog — lib/audit.ts's writeAuditLog remains the
 * sole write path (see that file and schema.prisma's AuditLog comment).
 */

import { Prisma, AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashRecord } from "@/lib/types";

export const AUDIT_LOG_DEFAULT_PAGE_SIZE = 50;
export const AUDIT_LOG_MAX_PAGE_SIZE = 200;

// Hard ceiling on a single export — a real regulator-facing export should
// never silently truncate without saying so. See generateAuditLogWorkbook
// below for how a hit against this cap is surfaced (a visible notice row
// in the workbook itself, not a silently short file).
export const AUDIT_LOG_EXPORT_ROW_CAP = 20000;

const CHAIN_VERIFY_BATCH_SIZE = 1000;

export interface AuditLogFilters {
  action?: AuditAction;
  /**
   * Coarse role bucket — "ADMIN" | "AUDITOR" | "MANUFACTURER" | "SYSTEM" |
   * "CLI" | ... — see deriveActorRole below. Not the raw `actor` column
   * value (which may carry an individual identity suffix, e.g.
   * "AUDITOR:<id>").
   */
  actorRole?: string;
  dateFrom?: Date;
  dateTo?: Date;
  /** Matches against the related PolymerPassport.batchId, case-insensitive substring. */
  batchId?: string;
}

/**
 * Buckets a free-text actor identity string into a coarse role label.
 * Mirrors this app's own established actor-string convention exactly
 * (see lib/audit.ts's WriteAuditLogParams comment and every service that
 * calls writeAuditLog): a bare role ("ADMIN", "AUDITOR", "MANUFACTURER"),
 * an individually-identified actor ("AUDITOR:<id>",
 * "manufacturer:<uuid>"), a scheduled job ("SYSTEM:CRON"), or a CLI
 * script ("CLI:<script-name>") all bucket to the text before their first
 * ":" — computed here rather than stored as a separate column, so a new
 * actor convention never needs a migration to become filterable.
 */
export function deriveActorRole(actor: string): string {
  const prefix = actor.includes(":") ? actor.split(":")[0] : actor;
  return prefix.toUpperCase();
}

async function resolveActorsForRole(role: string): Promise<string[]> {
  const distinctActors = await prisma.auditLog.findMany({
    distinct: ["actor"],
    select: { actor: true },
  });
  return distinctActors.map((a) => a.actor).filter((a) => deriveActorRole(a) === role.toUpperCase());
}

/**
 * Exported (not just used internally) so
 * lib/services/generate-audit-log-workbook.ts can build the exact same
 * where-clause an export's filters describe — "export what I'm currently
 * viewing" only works if both paths interpret AuditLogFilters identically.
 */
export async function buildAuditLogWhere(filters: AuditLogFilters): Promise<Prisma.AuditLogWhereInput> {
  const where: Prisma.AuditLogWhereInput = {};

  if (filters.action) where.action = filters.action;

  if (filters.actorRole) {
    const actors = await resolveActorsForRole(filters.actorRole);
    // An unrecognized role bucket (no matching actor in the table at
    // all) should return zero rows, not "no filter" — `in: []` does
    // exactly that in Prisma/Postgres.
    where.actor = { in: actors };
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    };
  }

  if (filters.batchId) {
    where.passport = { batchId: { contains: filters.batchId, mode: "insensitive" } };
  }

  return where;
}

export async function listAuditLogEntries(filters: AuditLogFilters = {}, page = 1, pageSize = AUDIT_LOG_DEFAULT_PAGE_SIZE) {
  const clampedPage = Math.max(1, Math.floor(page));
  const clampedPageSize = Math.min(Math.max(Math.floor(pageSize), 1), AUDIT_LOG_MAX_PAGE_SIZE);
  const where = await buildAuditLogWhere(filters);

  const [total, entries] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { sequence: "desc" },
      skip: (clampedPage - 1) * clampedPageSize,
      take: clampedPageSize,
      include: { passport: { select: { batchId: true, polymerType: true, grade: true, status: true } } },
    }),
  ]);

  return { entries, total, page: clampedPage, pageSize: clampedPageSize };
}

export interface AuditLogFilterOptions {
  actions: AuditAction[];
  actorRoles: string[];
}

export async function getAuditLogFilterOptions(): Promise<AuditLogFilterOptions> {
  const [actionRows, actorRows] = await Promise.all([
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true } }),
    prisma.auditLog.findMany({ distinct: ["actor"], select: { actor: true } }),
  ]);

  const roleSet = new Set(actorRows.map((r) => deriveActorRole(r.actor)));

  return {
    actions: actionRows.map((r) => r.action).sort(),
    actorRoles: Array.from(roleSet).sort(),
  };
}

// ----------------------------------------------------------------------------
// Hash-chain integrity verification
// ----------------------------------------------------------------------------

export interface AuditLogChainVerificationResult {
  ok: boolean;
  totalChecked: number;
  firstSequence: number | null;
  lastSequence: number | null;
  brokenAtSequence: number | null;
  brokenReason: string | null;
}

/**
 * Walks the ENTIRE AuditLog table in sequence order, recomputing each
 * row's entryHash from its own stored fields and comparing it against
 * both the stored entryHash and the next row's previousEntryHash pointer.
 * Any mismatch — a row whose data was edited, a row deleted (leaving a
 * pointer to a hash that no longer exists), or a row inserted out of
 * order — is caught and reported with the exact sequence number where the
 * chain first breaks.
 *
 * Deliberately checks the WHOLE table, not a sample — this function
 * backs an explicit "Verify Full Ledger" admin action (mirroring
 * lib/services/expiry-alert-service.ts's runExpiryAlertCheck being a
 * deliberate, on-demand action rather than something run on every page
 * load), not something invoked on every /admin/audit page view. Batched
 * (CHAIN_VERIFY_BATCH_SIZE rows at a time) so it scales to a large ledger
 * without loading it all into memory at once.
 */
export async function verifyAuditLogChainIntegrity(): Promise<AuditLogChainVerificationResult> {
  let cursor: number | null = null;
  let previousEntryHash: string | null = null;
  let totalChecked = 0;
  let firstSequence: number | null = null;
  let lastSequence: number | null = null;

  for (;;) {
    const batch = await prisma.auditLog.findMany({
      where: cursor !== null ? { sequence: { gt: cursor } } : undefined,
      orderBy: { sequence: "asc" },
      take: CHAIN_VERIFY_BATCH_SIZE,
    });
    if (batch.length === 0) break;

    for (const row of batch) {
      if (firstSequence === null) firstSequence = row.sequence;
      lastSequence = row.sequence;
      totalChecked++;

      if (row.previousEntryHash !== previousEntryHash) {
        return {
          ok: false,
          totalChecked,
          firstSequence,
          lastSequence,
          brokenAtSequence: row.sequence,
          brokenReason: `Entry #${row.sequence}'s previousEntryHash does not match the prior entry's stored hash — a row was likely deleted, reordered, or its chain pointer altered.`,
        };
      }

      const recomputed = hashRecord({
        sequence: row.sequence,
        passportId: row.passportId,
        action: row.action,
        actor: row.actor,
        previousHash: row.previousHash,
        newHash: row.newHash,
        metadata: row.metadata,
        createdAt: row.createdAt,
        previousEntryHash: row.previousEntryHash,
      });

      if (recomputed !== row.entryHash) {
        return {
          ok: false,
          totalChecked,
          firstSequence,
          lastSequence,
          brokenAtSequence: row.sequence,
          brokenReason: `Entry #${row.sequence}'s stored entryHash does not match a hash recomputed from its current field values — this row's data was modified after it was written.`,
        };
      }

      previousEntryHash = row.entryHash;
    }

    cursor = batch[batch.length - 1].sequence;
  }

  return { ok: true, totalChecked, firstSequence, lastSequence, brokenAtSequence: null, brokenReason: null };
}
