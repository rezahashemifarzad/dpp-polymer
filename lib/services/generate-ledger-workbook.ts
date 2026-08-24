/**
 * lib/services/generate-ledger-workbook.ts
 * -----------------------------------------------------------------------
 * Sprint 2.3 (Enterprise Compliance Reporting & PDF/Excel Export Module) —
 * the "Excel / CSV Data Export": a real, styled .xlsx workbook (via
 * `exceljs`, the one new dependency this sprint adds — nothing else in
 * this repo produced spreadsheets before) with two sheets:
 *
 *   1. "Material Ledger" — one row per active-or-not passport (every
 *      status is included here, unlike the ESG/compliance-report exports
 *      which exclude REVOKED/SUPERSEDED — a regulator reviewing the full
 *      ledger needs to see revoked/superseded rows too, just clearly
 *      labeled by their Status column).
 *   2. "Audit Trail" — every AuditLog row (passport-level state-change
 *      history), most recent first.
 *
 * Both queries use a narrow `select`/`include` (no full-row fetches) and
 * are capped (MAX_LEDGER_ROWS / MAX_AUDIT_ROWS) with a trailing note row
 * if truncated — "no silent caps" per this repo's existing conventions
 * (see generate-qr-label-sheet-pdf.tsx's identical MAX_BATCHES_PER_SHEET
 * pattern), so a very large ledger never silently produces an
 * incomplete-looking-but-uncaveated export.
 *
 * Deliberately excludes AuditorVerification.notes from every sheet — same
 * rule generate-compliance-report-pdf.tsx follows, per that model's own
 * schema comment ("Admin+portal-only... never surfaced on the public
 * passport page").
 */

import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";

const MAX_LEDGER_ROWS = 5000;
const MAX_AUDIT_ROWS = 5000;

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF0F172A" }, // matches this app's dark slate brand color
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

function addNoteRow(sheet: ExcelJS.Worksheet, columnCount: number, text: string) {
  const row = sheet.addRow([text]);
  sheet.mergeCells(row.number, 1, row.number, columnCount);
  row.getCell(1).font = { italic: true, color: { argb: "FF94A3B8" }, size: 9 };
}

async function buildMaterialLedgerSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet("Material Ledger", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Batch ID", key: "batchId", width: 20 },
    { header: "GTIN", key: "gtin", width: 16 },
    { header: "Polymer Type", key: "polymerType", width: 14 },
    { header: "Grade", key: "grade", width: 24 },
    { header: "Manufacturer", key: "manufacturer", width: 24 },
    { header: "Country", key: "country", width: 12 },
    { header: "Status", key: "status", width: 20 },
    { header: "Production Date", key: "productionDate", width: 16 },
    { header: "Recycled Content Source", key: "recycledContentSource", width: 20 },
    { header: "Recycled Content %", key: "recycledContentPercent", width: 16 },
    { header: "Total Recycled %", key: "totalRecycledPercent", width: 16 },
    { header: "Bio-Based %", key: "bioBasedPercent", width: 14 },
    { header: "Carbon Footprint (kg CO2e/kg)", key: "carbonFootprint", width: 22 },
    { header: "LCA Methodology", key: "lcaMethodology", width: 14 },
    { header: "Third-Party Verified LCA", key: "lcaVerified", width: 18 },
    { header: "Melt Flow Index", key: "mfi", width: 14 },
    { header: "Density (g/cm³)", key: "density", width: 14 },
    { header: "Certifications", key: "certifications", width: 36 },
    { header: "Record Hash", key: "recordHash", width: 20 },
    { header: "GS1 Verification URL", key: "qrCodePayloadUrl", width: 40 },
  ];
  styleHeaderRow(sheet.getRow(1));

  const total = await prisma.polymerPassport.count();
  const passports = await prisma.polymerPassport.findMany({
    orderBy: { productionDate: "desc" },
    take: MAX_LEDGER_ROWS,
    select: {
      batchId: true,
      gtin: true,
      polymerType: true,
      grade: true,
      status: true,
      productionDate: true,
      recycledContentSource: true,
      recycledContentPercent: true,
      totalRecycledPercent: true,
      bioBasedPercent: true,
      carbonFootprintKgCO2ePerKg: true,
      lcaMethodology: true,
      lcaThirdPartyVerified: true,
      meltFlowIndex: true,
      density: true,
      recordHash: true,
      qrCodePayloadUrl: true,
      manufacturer: { select: { legalName: true, country: true } },
      certifications: { select: { scheme: true, verificationStatus: true } },
    },
  });

  for (const p of passports) {
    sheet.addRow({
      batchId: p.batchId,
      gtin: p.gtin,
      polymerType: p.polymerType,
      grade: p.grade,
      manufacturer: p.manufacturer?.legalName ?? "—",
      country: p.manufacturer?.country ?? "—",
      status: p.status,
      productionDate: p.productionDate.toISOString().slice(0, 10),
      recycledContentSource: p.recycledContentSource ?? "—",
      recycledContentPercent: Number(p.recycledContentPercent),
      totalRecycledPercent: Number(p.totalRecycledPercent),
      bioBasedPercent: Number(p.bioBasedPercent),
      carbonFootprint: Number(p.carbonFootprintKgCO2ePerKg),
      lcaMethodology: p.lcaMethodology,
      lcaVerified: p.lcaThirdPartyVerified ? "Yes" : "No",
      mfi: Number(p.meltFlowIndex),
      density: Number(p.density),
      certifications: p.certifications.map((c) => `${c.scheme} (${c.verificationStatus})`).join("; ") || "—",
      recordHash: p.recordHash ?? "not yet signed",
      qrCodePayloadUrl: p.qrCodePayloadUrl ?? "—",
    });
  }

  if (passports.length < total) {
    addNoteRow(
      sheet,
      sheet.columns.length,
      `Showing the ${MAX_LEDGER_ROWS} most recently produced of ${total} total batches. Narrow your review window or contact an administrator for the complete export.`
    );
  }

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
  return passports.length;
}

async function buildAuditTrailSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet("Audit Trail", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Timestamp", key: "createdAt", width: 20 },
    { header: "Batch ID", key: "batchId", width: 20 },
    { header: "Action", key: "action", width: 20 },
    { header: "Actor", key: "actor", width: 22 },
    { header: "Previous Hash", key: "previousHash", width: 20 },
    { header: "New Hash", key: "newHash", width: 20 },
    { header: "Metadata", key: "metadata", width: 40 },
  ];
  styleHeaderRow(sheet.getRow(1));

  const total = await prisma.auditLog.count();
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: MAX_AUDIT_ROWS,
    select: {
      createdAt: true,
      action: true,
      actor: true,
      previousHash: true,
      newHash: true,
      metadata: true,
      passport: { select: { batchId: true } },
    },
  });

  const truncateHash = (h: string | null) => (h ? (h.length > 20 ? `${h.slice(0, 20)}...` : h) : "—");

  for (const log of logs) {
    sheet.addRow({
      createdAt: log.createdAt.toISOString().replace("T", " ").slice(0, 19),
      batchId: log.passport?.batchId ?? "—",
      action: log.action,
      actor: log.actor,
      previousHash: truncateHash(log.previousHash),
      newHash: truncateHash(log.newHash),
      metadata: log.metadata ? JSON.stringify(log.metadata) : "—",
    });
  }

  if (logs.length < total) {
    addNoteRow(
      sheet,
      sheet.columns.length,
      `Showing the ${MAX_AUDIT_ROWS} most recent of ${total} total audit log entries.`
    );
  }

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
  return logs.length;
}

export async function generateLedgerWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Polymer DPP";
  workbook.created = new Date();

  await buildMaterialLedgerSheet(workbook);
  await buildAuditTrailSheet(workbook);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
