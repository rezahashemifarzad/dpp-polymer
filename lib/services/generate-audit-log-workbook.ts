/**
 * lib/services/generate-audit-log-workbook.ts
 * -----------------------------------------------------------------------
 * Phase 4 - Step 3: Immutable Audit Trail / Ledger Log — a dedicated,
 * filterable, full-detail Excel export of the audit ledger, built for a
 * regulator or internal auditor to open directly (sortable/filterable
 * columns via autoFilter, one row per entry, no truncated hashes).
 *
 * Deliberately a SEPARATE file/sheet from
 * lib/services/generate-ledger-workbook.ts's own existing "Audit Trail"
 * sheet — that sheet is one page inside a broader Material Ledger export
 * (capped at the 20 most useful columns, hashes truncated for
 * readability). This export exists specifically for the audit trail
 * itself: it accepts the same filters the /admin/audit page's table
 * uses, includes the full hash-chain columns (entryHash/
 * previousEntryHash) the ledger export's sheet omits, and adds a second
 * "Integrity Verification" sheet stamping the export with a live
 * hash-chain check result — see lib/services/audit-log-service.ts's
 * verifyAuditLogChainIntegrity.
 */

import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import {
  AUDIT_LOG_EXPORT_ROW_CAP,
  buildAuditLogWhere,
  verifyAuditLogChainIntegrity,
  type AuditLogFilters,
} from "@/lib/services/audit-log-service";

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF0F172A" }, // matches this app's dark slate brand color, same as generate-ledger-workbook.ts
};
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFF8FAFC" }, size: 10 };

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle" };
  });
  row.height = 20;
}

function addNoteRow(sheet: ExcelJS.Worksheet, columnCount: number, text: string, warn = false) {
  const row = sheet.addRow([text]);
  sheet.mergeCells(row.number, 1, row.number, columnCount);
  row.getCell(1).font = {
    italic: true,
    bold: warn,
    color: { argb: warn ? "FFF59E0B" : "FF94A3B8" },
    size: 9,
  };
}

async function buildAuditLogSheet(workbook: ExcelJS.Workbook, filters: AuditLogFilters) {
  const sheet = workbook.addWorksheet("Audit Log", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Sequence", key: "sequence", width: 10 },
    { header: "Timestamp (UTC)", key: "createdAt", width: 22 },
    { header: "Action", key: "action", width: 26 },
    { header: "Actor", key: "actor", width: 24 },
    { header: "Batch ID", key: "batchId", width: 22 },
    { header: "Polymer Type", key: "polymerType", width: 14 },
    { header: "Grade", key: "grade", width: 22 },
    { header: "Previous Hash", key: "previousHash", width: 24 },
    { header: "New Hash", key: "newHash", width: 24 },
    { header: "Entry Hash", key: "entryHash", width: 24 },
    { header: "Previous Entry Hash", key: "previousEntryHash", width: 24 },
    { header: "Metadata", key: "metadata", width: 50 },
  ];
  styleHeaderRow(sheet.getRow(1));

  const where = await buildAuditLogWhere(filters);
  const total = await prisma.auditLog.count({ where });
  const entries = await prisma.auditLog.findMany({
    where,
    orderBy: { sequence: "desc" },
    take: AUDIT_LOG_EXPORT_ROW_CAP,
    include: { passport: { select: { batchId: true, polymerType: true, grade: true } } },
  });

  for (const entry of entries) {
    sheet.addRow({
      sequence: entry.sequence,
      createdAt: entry.createdAt.toISOString().replace("T", " ").slice(0, 19),
      action: entry.action,
      actor: entry.actor,
      batchId: entry.passport?.batchId ?? "—",
      polymerType: entry.passport?.polymerType ?? "—",
      grade: entry.passport?.grade ?? "—",
      previousHash: entry.previousHash ?? "—",
      newHash: entry.newHash ?? "—",
      entryHash: entry.entryHash,
      previousEntryHash: entry.previousEntryHash ?? "(genesis entry)",
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : "—",
    });
  }

  if (entries.length < total) {
    addNoteRow(
      sheet,
      sheet.columns.length,
      `TRUNCATED: showing the ${AUDIT_LOG_EXPORT_ROW_CAP} most recent of ${total} matching entries. Narrow the date range or action/actor filters to export the remainder.`,
      true
    );
  }

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
  return { rowsExported: entries.length, totalMatching: total };
}

async function buildIntegritySheet(
  workbook: ExcelJS.Workbook,
  exportedAt: Date,
  rowsExported: number,
  totalMatching: number,
  filters: AuditLogFilters
) {
  const sheet = workbook.addWorksheet("Integrity Verification");
  sheet.columns = [
    { header: "Field", key: "field", width: 32 },
    { header: "Value", key: "value", width: 60 },
  ];
  styleHeaderRow(sheet.getRow(1));

  const verification = await verifyAuditLogChainIntegrity();

  const filterSummary =
    Object.keys(filters).length === 0
      ? "(none — full ledger)"
      : JSON.stringify(filters, (_key, v) => (v instanceof Date ? v.toISOString() : v));

  const rows: [string, string][] = [
    ["Export generated at (UTC)", exportedAt.toISOString()],
    ["Filters applied to the Audit Log sheet", filterSummary],
    ["Rows exported / matching this filter", `${rowsExported} / ${totalMatching}`],
    ["", ""],
    ["Full-ledger hash-chain integrity", verification.ok ? "VERIFIED — no tampering detected" : "BROKEN — see reason below"],
    ["Entries checked (entire ledger, ignores filters above)", String(verification.totalChecked)],
    ["First sequence checked", verification.firstSequence !== null ? `#${verification.firstSequence}` : "—"],
    ["Last sequence checked", verification.lastSequence !== null ? `#${verification.lastSequence}` : "—"],
    ...(verification.ok
      ? []
      : ([
          ["Broken at sequence", `#${verification.brokenAtSequence}`],
          ["Reason", verification.brokenReason ?? ""],
        ] as [string, string][])),
  ];

  for (const [field, value] of rows) {
    sheet.addRow({ field, value });
  }

  if (!verification.ok) {
    sheet.getRow(6).font = { bold: true, color: { argb: "FFEF4444" } };
  }

  return verification;
}

export async function generateAuditLogWorkbook(filters: AuditLogFilters = {}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Polymer DPP";
  workbook.created = new Date();
  const exportedAt = new Date();

  const { rowsExported, totalMatching } = await buildAuditLogSheet(workbook, filters);
  await buildIntegritySheet(workbook, exportedAt, rowsExported, totalMatching, filters);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
