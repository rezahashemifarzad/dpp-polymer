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
 *
 * Sprint 3.2 (Green Tax & Audit Reports Export) addition: a SECOND,
 * separate workbook export — generateGreenTaxWorkbook() — living in this
 * same file so it can reuse the styling helpers above (styleHeaderRow,
 * addNoteRow, HEADER_FILL/HEADER_FONT), but built and exposed
 * independently of generateLedgerWorkbook(). Two sheets:
 *
 *   3. "Green Accounting" — one row per active batch's live plastic-tax
 *      figures (mass, PCR mass, taxable mass, gross/savings/net
 *      liability, whether locked), reusing lib/services/
 *      plastic-tax-calculator.ts's computePortfolioGreenAccounting() so
 *      this sheet can never disagree with the /admin/green-accounting
 *      dashboard for the same portfolio.
 *   4. "Green Valuation History" — every AuditLog row where
 *      action = "GREEN_VALUATION_SAVED", each row's `metadata` JSON
 *      unpacked into its own columns (netLiabilityEur,
 *      pcrTaxSavingsEur, ratePerTonneEur at the time of that save). This
 *      is the genuine append-only "historical snapshots for regulatory
 *      reviews" the request asks for — BatchGreenValuation itself is
 *      deliberately "latest only" (see its own schema comment, mirroring
 *      CarbonFootprintCalculation's upsert pattern), so it cannot show a
 *      batch's valuation history by itself; the AuditLog trail this
 *      sheet reads from is written in the same $transaction as every
 *      BatchGreenValuation upsert (see
 *      lib/services/plastic-tax-calculator.ts's saveBatchGreenValuation)
 *      and is never overwritten, so it already IS that history.
 *
 * Kept as a separate, green-tax-only export (not folded into the four-
 * sheet Material Ledger workbook) because the UI's own "Export Tax &
 * Financial Excel" button on /admin/green-accounting is a focused,
 * green-tax-specific deliverable, distinct from the full-ledger
 * "Download Ledger Excel" button elsewhere in the admin console —
 * exactly the same reasoning that keeps
 * generate-green-tax-report-pdf.tsx a separate PDF from
 * generate-compliance-report-pdf.tsx rather than one document trying to
 * serve two different audiences/purposes. generateLedgerWorkbook() and
 * its existing two sheets are completely untouched by this addition.
 */

import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { computePortfolioGreenAccounting } from "@/lib/services/plastic-tax-calculator";

const MAX_LEDGER_ROWS = 5000;
const MAX_AUDIT_ROWS = 5000;
const MAX_GREEN_BATCH_ROWS = 5000;
const MAX_GREEN_HISTORY_ROWS = 5000;

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
  workbook.creator = "DPP-Polymer";
  workbook.created = new Date();

  await buildMaterialLedgerSheet(workbook);
  await buildAuditTrailSheet(workbook);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// =============================================================================
// Sprint 3.2 — Green Tax & Audit Reports Export (Excel Workbook Extension)
// =============================================================================

async function buildGreenAccountingSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet("Green Accounting", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Batch ID", key: "batchId", width: 20 },
    { header: "Polymer Type", key: "polymerType", width: 14 },
    { header: "Grade", key: "grade", width: 24 },
    { header: "Manufacturer", key: "manufacturer", width: 24 },
    { header: "Status", key: "status", width: 20 },
    { header: "Has Weight Data", key: "hasWeightData", width: 16 },
    { header: "Batch Mass (kg)", key: "batchMassKg", width: 16 },
    { header: "PCR Mass (kg)", key: "pcrMassKg", width: 16 },
    { header: "Taxable Mass (kg)", key: "taxableMassKg", width: 16 },
    { header: "Rate (EUR/tonne)", key: "ratePerTonneEur", width: 16 },
    { header: "Gross Liability (EUR)", key: "grossLiabilityEur", width: 18 },
    { header: "PCR Tax Savings (EUR)", key: "pcrTaxSavingsEur", width: 18 },
    { header: "Net Liability (EUR)", key: "netLiabilityEur", width: 18 },
    { header: "Locked Valuation", key: "hasLockedValuation", width: 16 },
  ];
  styleHeaderRow(sheet.getRow(1));

  const summary = await computePortfolioGreenAccounting();
  const rows = summary.batches.slice(0, MAX_GREEN_BATCH_ROWS);

  for (const b of rows) {
    sheet.addRow({
      batchId: b.batchId,
      polymerType: b.polymerType,
      grade: b.grade,
      manufacturer: b.manufacturerName ?? "—",
      status: b.status,
      hasWeightData: b.hasWeightData ? "Yes" : "No",
      batchMassKg: b.batchMassKg,
      pcrMassKg: b.pcrMassKg,
      taxableMassKg: b.taxableMassKg,
      ratePerTonneEur: summary.ratePerTonneEur,
      grossLiabilityEur: b.grossLiabilityEur,
      pcrTaxSavingsEur: b.pcrTaxSavingsEur,
      netLiabilityEur: b.netLiabilityEur,
      hasLockedValuation: b.hasLockedValuation ? "Yes" : "No",
    });
  }

  addNoteRow(
    sheet,
    sheet.columns.length,
    `Portfolio totals — Gross: €${summary.totalGrossLiabilityEur.toLocaleString()} · PCR Savings: €${summary.totalPcrTaxSavingsEur.toLocaleString()} · Net: €${summary.totalNetLiabilityEur.toLocaleString()}. ${summary.disclaimer}`
  );
  if (rows.length < summary.batches.length) {
    addNoteRow(
      sheet,
      sheet.columns.length,
      `Showing the ${MAX_GREEN_BATCH_ROWS} most recent of ${summary.batches.length} active batches.`
    );
  }

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
  return rows.length;
}

async function buildGreenValuationHistorySheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet("Green Valuation History", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Timestamp", key: "createdAt", width: 20 },
    { header: "Batch ID", key: "batchId", width: 20 },
    { header: "Actor", key: "actor", width: 22 },
    { header: "Net Liability (EUR)", key: "netLiabilityEur", width: 18 },
    { header: "PCR Tax Savings (EUR)", key: "pcrTaxSavingsEur", width: 18 },
    { header: "Rate (EUR/tonne)", key: "ratePerTonneEur", width: 16 },
  ];
  styleHeaderRow(sheet.getRow(1));

  // Every past GREEN_VALUATION_SAVED audit entry, oldest snapshot data
  // preserved exactly as recorded at save time — this is the genuine
  // append-only history (see this file's own banner comment). A
  // BatchGreenValuation row itself is only ever "latest" per passport, so
  // this AuditLog trail is the only place a batch's prior valuations
  // (before being re-locked at a new rate, or re-locked after a weight
  // correction) remain visible for a regulator to review.
  const total = await prisma.auditLog.count({ where: { action: "GREEN_VALUATION_SAVED" } });
  const logs = await prisma.auditLog.findMany({
    where: { action: "GREEN_VALUATION_SAVED" },
    orderBy: { createdAt: "desc" },
    take: MAX_GREEN_HISTORY_ROWS,
    select: {
      createdAt: true,
      actor: true,
      metadata: true,
      passport: { select: { batchId: true } },
    },
  });

  for (const log of logs) {
    const meta = (log.metadata ?? {}) as Record<string, unknown>;
    sheet.addRow({
      createdAt: log.createdAt.toISOString().replace("T", " ").slice(0, 19),
      batchId: log.passport?.batchId ?? "—",
      actor: log.actor,
      netLiabilityEur: typeof meta.netLiabilityEur === "number" ? meta.netLiabilityEur : "—",
      pcrTaxSavingsEur: typeof meta.pcrTaxSavingsEur === "number" ? meta.pcrTaxSavingsEur : "—",
      ratePerTonneEur: typeof meta.ratePerTonneEur === "number" ? meta.ratePerTonneEur : "—",
    });
  }

  if (logs.length < total) {
    addNoteRow(
      sheet,
      sheet.columns.length,
      `Showing the ${MAX_GREEN_HISTORY_ROWS} most recent of ${total} total valuation-lock events.`
    );
  }
  if (logs.length === 0) {
    addNoteRow(sheet, sheet.columns.length, "No valuations have been locked yet — see the Green Accounting sheet for live (unlocked) figures.");
  }

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
  return logs.length;
}

export async function generateGreenTaxWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DPP-Polymer";
  workbook.created = new Date();

  // Primary data — a failure here means the workbook has nothing
  // meaningful to offer (this sheet carries every active batch's current
  // live figures), so let it propagate rather than silently shipping an
  // empty/misleading file.
  await buildGreenAccountingSheet(workbook);

  // Supplementary — final Polish & Stability Sprint: the audit-trail
  // history sheet is valuable but not essential (the Green Accounting
  // sheet above already carries every batch's current live figures), so
  // a failure building it must not lose the whole export. Degrades to a
  // clearly-labeled placeholder sheet instead of failing the download,
  // same "essential vs. supplementary" split as generateGreenTaxReportPdf()'s
  // auditor sign-off query.
  try {
    await buildGreenValuationHistorySheet(workbook);
  } catch (err) {
    console.error(
      "generateGreenTaxWorkbook: failed to build Green Valuation History sheet — degrading gracefully, Green Accounting sheet unaffected",
      err
    );
    const fallback = workbook.addWorksheet("Green Valuation History");
    fallback.columns = [{ header: "Notice", key: "notice", width: 110 }];
    styleHeaderRow(fallback.getRow(1));
    fallback.addRow({
      notice:
        "This sheet could not be generated for this export due to a transient error. The Green Accounting sheet's figures are unaffected and complete. Re-generate the export to retry.",
    });
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
