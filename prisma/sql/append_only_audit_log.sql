-- prisma/sql/append_only_audit_log.sql
-- -----------------------------------------------------------------------
-- Phase 4 - Step 3: Immutable Audit Trail / Ledger Log — database-level
-- append-only enforcement for the "AuditLog" table.
--
-- Prisma's schema language has no declarative way to express "no UPDATE,
-- no DELETE" on a model, so this hardening lives as a plain SQL step
-- applied directly against Postgres (Neon) rather than in schema.prisma.
-- It is purely additive: it does not touch any existing table, column,
-- constraint, or row, and every application code path already only ever
-- calls AuditLog.create() (see lib/audit.ts) — this trigger changes
-- nothing about how the app behaves today. What it adds is a hard
-- guarantee that CANNOT be bypassed by an application bug, a stray
-- Prisma Studio edit, or a compromised app-layer credential: even a
-- direct UPDATE or DELETE against "AuditLog" run from psql, a database
-- GUI, or any other client is rejected at the database layer, full stop.
--
-- This is what turns AuditLog.entryHash/previousEntryHash (see
-- schema.prisma's AuditLog comment) from an unenforced convention into a
-- real guarantee: the hash chain lets you PROVE the ledger wasn't
-- tampered with; this trigger is what actually STOPS the tampering in
-- the first place. Together they're the two halves of "immutable audit
-- trail" — detection and prevention.
--
-- HOW TO APPLY (one-time, after the AuditLog table already exists — i.e.
-- after `npx prisma migrate dev` / `npx prisma db push` for this Step's
-- schema changes has already run):
--
--   npx prisma db execute --file prisma/sql/append_only_audit_log.sql --schema prisma/schema.prisma
--
-- ...or paste this file's contents directly into the Neon SQL editor /
-- any Postgres client connected to the same database. Safe to re-run —
-- every statement below is idempotent (CREATE OR REPLACE, DROP ... IF
-- EXISTS first).
--
-- NOTE: this trigger will also reject Prisma's own migration tooling if
-- a FUTURE schema change ever needs to ALTER the AuditLog table's
-- columns in a way that requires UPDATEing existing rows (adding a new
-- NOT NULL column with a backfill, for example) — that is intentional,
-- not a bug: if that day comes, the trigger should be temporarily
-- dropped (DROP TRIGGER ...), the migration applied, and the trigger
-- immediately recreated by re-running this file, with the change
-- reviewed specifically because it's touching write-once compliance
-- data.

CREATE OR REPLACE FUNCTION reject_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only: % is not permitted (attempted on id=%, sequence=%)',
    TG_OP,
    COALESCE(OLD.id, NEW.id),
    COALESCE(OLD.sequence, NEW.sequence);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON "AuditLog";
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON "AuditLog"
  FOR EACH ROW
  EXECUTE FUNCTION reject_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_log_no_delete ON "AuditLog";
CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON "AuditLog"
  FOR EACH ROW
  EXECUTE FUNCTION reject_audit_log_mutation();
