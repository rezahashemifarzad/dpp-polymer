/**
 * lib/services/generate-esg-analytics-workbook.ts
 * -----------------------------------------------------------------------
 * Phase 5: Advanced ESG & Carbon Analytics Dashboard — the "ESG Data
 * Sheets" workbook: a full-detail Excel export of everything
 * lib/services/esg-analytics.ts computes, built for an external auditor
 * or ESG analyst who needs the underlying data tables (manufacturer
 * distribution, material grade distribution, PPWR target comparison,
 * readiness index breakdown), not just the compact portfolio summary
 * that lib/services/generate-compliance-report-pdf.tsx's PDF already
 * covers.
 *
 * Deliberately a SEPARATE export from that PDF, same relationship as
 * generate-audit-log-workbook.ts vs generate-ledger-workbook.ts's own
 * "Audit Trail" sheet — the PDF is the compact, page-bounded "official
 * summary" version; this workbook is the full, sortable/filterable "data
 * sheets" version the CSV/JSON export buttons approximate on the client
 * but a real spreadsheet does better (frozen headers, autoFilter,
 * multiple sheets instead of one flat concatenated file).
 *
 * Reuses getEsgAnalytics() for every figure — same "compute, don't store"
 * principle, and guarantees this workbook can never disagree with the
 * dashboard or the compliance PDF for the same portfolio, all three being
 * fed from one aggregation function.
 *
 * Styling matches this app's one established @exceljs pattern exactly
 * (HEADER_FILL/HEADER_FONT/styleHeaderRow/addNoteRow — see
 * generate-ledger-workbook.ts and generate-audit-log-workbook.ts) rather
 * than introducing a second visual style for exports.
 */

import ExcelJS from "exceljs";
import { getEsgAnalytics } from "@/lib/services/esg-analytics";

// Defensive caps, matching this app's "no silent caps" export convention
// — a visible amber note row is added if either is hit rather than the
// export simply being shorter than expected with no explanation.
const MAX_MANUFACTURER_ROWS = 2000;
const MAX_GRADE_ROWS = 2000;

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF0F172A" },
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

export async function generateEsgAnalyticsWorkbook(): Promise<Buffer> {
  const esg = await getEsgAnalytics();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DPP-Polymer";
  workbook.created = new Date();

  // --- Sheet 1: ESG Summary --------------------------------------------------
  const summarySheet = workbook.addWorksheet("ESG Summary");
  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 42 },
    { header: "Value", key: "value", width: 24 },
    { header: "Unit / Note", key: "note", width: 50 },
  ];
  styleHeaderRow(summarySheet.getRow(1));
  const summaryRows: [string, string | number, string][] = [
    ["Generated At (UTC)", esg.generatedAt, ""],
    ["Total Batches", esg.totalBatches, "count"],
    ["Active Batches", esg.activeBatches, "excludes Revoked/Superseded"],
    ["Excluded Batches", esg.excludedBatches, "Revoked or Superseded"],
    ["PCR Mass Consumed", esg.pcrMass.pcrMassKg, "kg"],
    ["PIR Mass (context only)", esg.pcrMass.pirMassKg, "kg"],
    ["Total Weighed Mass", esg.pcrMass.totalMassKg, "kg"],
    ["PCR Adoption Rate", esg.pcrMass.pcrAdoptionRatePercent, "% of weighed mass"],
    ["Batches With Weight Data", esg.pcrMass.batchesWithWeightData, "count"],
    ["Batches Missing Weight Data", esg.pcrMass.batchesMissingWeightData, "count"],
    ["Total Verified Carbon Footprint (LCA x mass)", esg.carbon.totalVerifiedKgCO2e ?? "n/a", "kg CO2e"],
    ["Total Illustrative Carbon Estimate", esg.carbon.totalIllustrativeEstimateKgCO2e ?? "n/a", "kg CO2e"],
    ["Avg Verified Carbon Intensity", esg.carbon.avgVerifiedIntensityKgCO2ePerKg ?? "n/a", "kg CO2e/kg"],
    ["Third-Party Verified LCA Batches", esg.carbon.thirdPartyVerifiedCount, "count"],
    ["Third-Party Verified LCA Rate", esg.carbon.thirdPartyVerifiedPercent, "%"],
    ["EU Plastic Tax Relief Rate", esg.taxRelief.ratePerTonneEur, "EUR/tonne (illustrative)"],
    ["Estimated Tax Relief", esg.taxRelief.estimatedReliefEur, "EUR (illustrative)"],
    ["Total Certifications", esg.compliance.totalCertifications, "count"],
    ["Certifications Verified", esg.compliance.verified, `${esg.compliance.verifiedPercent}%`],
    ["Certifications Pending Review", esg.compliance.pendingReview, `${esg.compliance.pendingReviewPercent}%`],
    ["Certifications Rejected", esg.compliance.rejected, `${esg.compliance.rejectedPercent}%`],
    ["Verified Certs Currently Valid", esg.compliance.verifiedCurrentlyValid, "count"],
    ["Verified Certs Expiring Soon", esg.compliance.verifiedExpiringSoon, "count"],
    ["Verified Certs Expired", esg.compliance.verifiedExpired, "count"],
  ];
  for (const [metric, value, note] of summaryRows) summarySheet.addRow({ metric, value, note });
  summarySheet.addRow({});
  addNoteRow(summarySheet, 3, esg.taxRelief.disclaimer);
  summarySheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 3 } };

  // --- Sheet 2: Readiness Index -----------------------------------------------
  const readinessSheet = workbook.addWorksheet("Readiness Index");
  readinessSheet.columns = [
    { header: "Component", key: "component", width: 40 },
    { header: "Score (/100)", key: "score", width: 14 },
    { header: "Weight", key: "weight", width: 12 },
    { header: "Detail", key: "detail", width: 70 },
  ];
  styleHeaderRow(readinessSheet.getRow(1));
  readinessSheet.addRow({
    component: `OVERALL SCORE — ${esg.readinessIndex.rating}`,
    score: esg.readinessIndex.overallScore,
    weight: "100%",
    detail: esg.readinessIndex.methodologyNote,
  });
  readinessSheet.getRow(2).font = { bold: true };
  for (const c of esg.readinessIndex.components) {
    readinessSheet.addRow({ component: c.label, score: c.score, weight: `${Math.round(c.weight * 100)}%`, detail: c.detail });
  }
  readinessSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 4 } };

  // --- Sheet 3: PPWR Regulatory Targets ---------------------------------------
  const ppwrSheet = workbook.addWorksheet("PPWR Regulatory Targets");
  ppwrSheet.columns = [
    { header: "Category", key: "category", width: 34 },
    { header: "Year", key: "year", width: 10 },
    { header: "Target %", key: "target", width: 12 },
    { header: "Actual %", key: "actual", width: 12 },
    { header: "Gap (pp)", key: "gap", width: 12 },
    { header: "On Track", key: "onTrack", width: 12 },
  ];
  styleHeaderRow(ppwrSheet.getRow(1));
  for (const t of esg.regulatoryCompliance.targets) {
    ppwrSheet.addRow({
      category: t.category,
      year: t.year,
      target: t.targetPercent,
      actual: t.actualPercent,
      gap: t.gapPercentagePoints,
      onTrack: t.onTrack ? "Yes" : "No",
    });
  }
  ppwrSheet.addRow({});
  addNoteRow(ppwrSheet, 6, esg.regulatoryCompliance.disclaimer);
  ppwrSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 6 } };

  // --- Sheet 4: Manufacturer Distribution --------------------------------------
  const manufacturerSheet = workbook.addWorksheet("Manufacturer Distribution", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  manufacturerSheet.columns = [
    { header: "Manufacturer", key: "manufacturerName", width: 30 },
    { header: "Country", key: "country", width: 16 },
    { header: "Batches", key: "batchCount", width: 12 },
    { header: "% of Portfolio", key: "batchCountPercent", width: 14 },
    { header: "Avg Recycled %", key: "avgRecycledContentPercent", width: 16 },
    { header: "Avg Verified Carbon (kg CO2e/kg)", key: "avgVerifiedCarbonIntensityKgCO2ePerKg", width: 24 },
    { header: "Mass (kg)", key: "totalMassKg", width: 14 },
  ];
  styleHeaderRow(manufacturerSheet.getRow(1));
  const manufacturerRows = esg.manufacturerDistribution.slice(0, MAX_MANUFACTURER_ROWS);
  for (const m of manufacturerRows) {
    manufacturerSheet.addRow({
      manufacturerName: m.manufacturerName,
      country: m.country ?? "—",
      batchCount: m.batchCount,
      batchCountPercent: m.batchCountPercent,
      avgRecycledContentPercent: m.avgRecycledContentPercent,
      avgVerifiedCarbonIntensityKgCO2ePerKg: m.avgVerifiedCarbonIntensityKgCO2ePerKg ?? "—",
      totalMassKg: m.totalMassKg,
    });
  }
  if (manufacturerRows.length < esg.manufacturerDistribution.length) {
    addNoteRow(
      manufacturerSheet,
      7,
      `TRUNCATED: showing ${manufacturerRows.length} of ${esg.manufacturerDistribution.length} manufacturer buckets.`,
      true
    );
  }
  manufacturerSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 7 } };

  // --- Sheet 5: Material Grade Distribution ------------------------------------
  const gradeSheet = workbook.addWorksheet("Material Grade Distribution", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  gradeSheet.columns = [
    { header: "Polymer Type", key: "polymerType", width: 16 },
    { header: "Grade", key: "grade", width: 34 },
    { header: "Batches", key: "batchCount", width: 12 },
    { header: "% of Portfolio", key: "batchCountPercent", width: 14 },
    { header: "Avg Recycled %", key: "avgRecycledContentPercent", width: 16 },
  ];
  styleHeaderRow(gradeSheet.getRow(1));
  const gradeRows = esg.gradeDistribution.slice(0, MAX_GRADE_ROWS);
  for (const g of gradeRows) {
    gradeSheet.addRow({
      polymerType: g.polymerType,
      grade: g.grade,
      batchCount: g.batchCount,
      batchCountPercent: g.batchCountPercent,
      avgRecycledContentPercent: g.avgRecycledContentPercent,
    });
  }
  if (gradeRows.length < esg.gradeDistribution.length) {
    addNoteRow(gradeSheet, 5, `TRUNCATED: showing ${gradeRows.length} of ${esg.gradeDistribution.length} grade combinations.`, true);
  }
  gradeSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 5 } };

  // --- Sheet 6: Monthly Trend ---------------------------------------------------
  const trendSheet = workbook.addWorksheet("Monthly Trend");
  trendSheet.columns = [
    { header: "Month", key: "month", width: 12 },
    { header: "Batch Count", key: "batchCount", width: 14 },
    { header: "Avg Recycled Content %", key: "avgRecycledContentPercent", width: 22 },
    { header: "Avg Verified Carbon Intensity (kg CO2e/kg)", key: "avgVerifiedCarbonIntensityKgCO2ePerKg", width: 30 },
  ];
  styleHeaderRow(trendSheet.getRow(1));
  for (const point of esg.monthlyTrend) {
    trendSheet.addRow(point);
  }
  trendSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 4 } };

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
