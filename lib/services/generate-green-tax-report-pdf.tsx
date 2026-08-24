/**
 * lib/services/generate-green-tax-report-pdf.tsx
 * -----------------------------------------------------------------------
 * Sprint 3.2 (Green Tax & Audit Reports Export) — the official "Green Tax
 * & Plastic Packaging Compliance Report": a portfolio-wide EU Plastic
 * Packaging Tax / green accounting PDF, distinct from
 * generate-compliance-report-pdf.tsx's general EU ESPR 2026 report (that
 * one covers material/LCA/certification compliance broadly; this one is
 * scoped specifically to the plastic-tax financial figures introduced in
 * Sprint 3.1).
 *
 * Reuses lib/services/plastic-tax-calculator.ts's
 * computePortfolioGreenAccounting() and getActiveTaxParameter() for every
 * figure rather than re-deriving them — same "the PDF must never disagree
 * with the live dashboard for the same portfolio" rule
 * generate-compliance-report-pdf.tsx already follows for
 * lib/services/esg-analytics.ts.
 *
 * Styled to match this repo's one established PDF design language exactly
 * (same @react-pdf/renderer StyleSheet color values, Helvetica/Courier
 * fonts, row/label/value and table patterns as
 * generate-compliance-report-pdf.tsx and generate-certificate-pdf.tsx) —
 * not a new visual style.
 *
 * Three sections beyond the portfolio summary:
 *   - "Tax Calculation Breakdown": the active tax parameter (jurisdiction,
 *     rate, effective date) plus a plain-language restatement of the
 *     gross/savings/net formula, so a reader unfamiliar with the app can
 *     verify the figures by hand.
 *   - "Per-Batch Green Valuation": every active batch with recorded
 *     weight data, most recently produced first, capped at MAX_BATCH_ROWS
 *     with an explicit "showing N of M" note if truncated (never a silent
 *     cap, same convention as the compliance report and ledger workbook).
 *   - "Third-Party Auditor Sign-Offs (Portfolio)": the same portfolio-wide
 *     AuditorVerification register generate-compliance-report-pdf.tsx
 *     renders — this schema has no concept of an auditor signing off on a
 *     tax valuation specifically (AuditorVerification verifies a
 *     passport's material/LCA claims, not its plastic-tax figures), so
 *     this section is included as supporting portfolio context, clearly
 *     labeled as such, alongside a blank, printable "Report
 *     Certification" block (Prepared By / Reviewed By / Approved By) for
 *     this specific filing — a standard feature of official tax/
 *     compliance documents that needs no new schema, purely presentational.
 *
 * Like the compliance report, content is left to react-pdf's automatic
 * pagination; the footer uses `fixed` + a `render` callback so "Page X of
 * Y" is correct on every page.
 */

import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import {
  computePortfolioGreenAccounting,
  type PortfolioGreenAccountingSummary,
} from "@/lib/services/plastic-tax-calculator";

const MAX_BATCH_ROWS = 300;
const MAX_SIGNOFF_ROWS = 40;

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1e293b" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: "2 solid #0f172a",
    paddingBottom: 12,
    marginBottom: 16,
  },
  brand: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#0f172a", letterSpacing: 1 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#0f172a", marginTop: 3 },
  subtitle: { fontSize: 9, color: "#64748b", marginTop: 2 },
  badge: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 3,
    backgroundColor: "#ecfccb", // lime-100 — matches the Green Accounting UI's lime accent
    color: "#3f6212", // lime-800
  },
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionNote: { fontSize: 8, color: "#94a3b8", marginBottom: 6, marginTop: -3 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 },
  kpiCard: { width: "25%", paddingHorizontal: 6, marginBottom: 10 },
  kpiLabel: { fontSize: 7, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4 },
  kpiValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#0f172a", marginTop: 2 },
  kpiSub: { fontSize: 7, color: "#94a3b8", marginTop: 1 },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: "42%", color: "#64748b" },
  value: { width: "58%", fontFamily: "Helvetica-Bold", color: "#0f172a" },
  formulaBox: {
    backgroundColor: "#f8fafc",
    border: "1 solid #e2e8f0",
    borderRadius: 4,
    padding: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  formulaLine: { fontFamily: "Courier", fontSize: 8, color: "#334155", marginBottom: 2 },
  table: { borderTop: "1 solid #e2e8f0" },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableHeaderCell: { flex: 1, fontSize: 7, fontFamily: "Helvetica-Bold", color: "#f8fafc", textTransform: "uppercase" },
  tableRow: { flexDirection: "row", borderBottom: "1 solid #e2e8f0", paddingVertical: 4, paddingHorizontal: 4 },
  tableCell: { flex: 1, fontSize: 8, paddingRight: 4, color: "#334155" },
  mono: { fontFamily: "Courier", fontSize: 7, color: "#475569" },
  disclaimer: { fontSize: 7.5, color: "#94a3b8", marginTop: 4, lineHeight: 1.4 },
  signOffGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -8, marginTop: 6 },
  signOffCard: { width: "33.33%", paddingHorizontal: 8, marginBottom: 10 },
  signOffLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#0f172a", marginBottom: 18 },
  signOffLine: { borderTop: "1 solid #94a3b8", paddingTop: 3 },
  signOffCaption: { fontSize: 7, color: "#94a3b8" },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    borderTop: "1 solid #e2e8f0",
    paddingTop: 8,
    fontSize: 7.5,
    color: "#94a3b8",
  },
});

interface SignOffRow {
  batchId: string;
  auditorName: string;
  auditorOrganization: string;
  status: string;
  signedAt: string;
  signatureHash: string;
}

function truncateHash(hash: string, lead = 12, tail = 6): string {
  if (hash.length <= lead + tail) return hash;
  return `${hash.slice(0, lead)}...${hash.slice(-tail)}`;
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      {sub && <Text style={styles.kpiSub}>{sub}</Text>}
    </View>
  );
}

function eur(n: number): string {
  return `€${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function GreenTaxReportDocument({
  summary,
  signOffs,
  signOffsTotal,
  generatedAt,
}: {
  summary: PortfolioGreenAccountingSummary;
  signOffs: SignOffRow[];
  signOffsTotal: number;
  generatedAt: string;
}) {
  const batchesShown = summary.batches.slice(0, MAX_BATCH_ROWS);

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.brand}>POLYMER DPP</Text>
            <Text style={styles.title}>Green Tax &amp; Plastic Packaging Compliance Report</Text>
            <Text style={styles.subtitle}>EU Plastic Packaging Tax &amp; Green Accounting Summary</Text>
          </View>
          <Text style={styles.badge}>GREEN ACCOUNTING</Text>
        </View>

        {/* --- Portfolio Summary --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Portfolio Summary</Text>
          <View style={styles.kpiGrid}>
            <KpiCard
              label="Gross Liability"
              value={eur(summary.totalGrossLiabilityEur)}
              sub={`If 0% of active mass were recycled — ${(summary.totalMassKg / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} t total`}
            />
            <KpiCard
              label="PCR Tax Savings"
              value={eur(summary.totalPcrTaxSavingsEur)}
              sub={`${(summary.totalPcrMassKg / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} t PCR mass offsetting liability`}
            />
            <KpiCard
              label="Net Liability"
              value={eur(summary.totalNetLiabilityEur)}
              sub={`On ${(summary.totalTaxableMassKg / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} t non-recycled taxable mass`}
            />
            <KpiCard
              label="Active Rate"
              value={`${summary.ratePerTonneEur} EUR/t`}
              sub={`${summary.jurisdiction} · ${summary.taxParameterLabel}`}
            />
          </View>
          <Text style={styles.disclaimer}>{summary.disclaimer}</Text>
        </View>

        {/* --- Tax Calculation Breakdown --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tax Calculation Breakdown</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Jurisdiction</Text>
            <Text style={styles.value}>{summary.jurisdiction}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Active Tax Parameter</Text>
            <Text style={styles.value}>{summary.taxParameterLabel}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Rate</Text>
            <Text style={styles.value}>€{summary.ratePerTonneEur} / tonne</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Batches With Weight Data</Text>
            <Text style={styles.value}>
              {summary.batchesWithWeightData} of {summary.activeBatches} active ({summary.batchesMissingWeightData}{" "}
              excluded, no weight on record)
            </Text>
          </View>
          <View style={styles.formulaBox}>
            <Text style={styles.formulaLine}>Gross Liability (EUR)  =  (Batch Mass kg / 1000) × Rate per tonne</Text>
            <Text style={styles.formulaLine}>
              PCR Tax Savings (EUR)  =  (Post-Consumer Recycled Mass kg / 1000) × Rate per tonne
            </Text>
            <Text style={styles.formulaLine}>Net Liability (EUR)  =  Gross Liability − PCR Tax Savings</Text>
          </View>
          <Text style={styles.disclaimer}>
            PCR (Post-Consumer Recycled) mass only counts toward tax savings — Post-Industrial Recycled content is
            excluded, matching how the underlying levy mechanism rewards recycled content specifically.
          </Text>
        </View>

        {/* --- Per-Batch Green Valuation --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Per-Batch Green Valuation</Text>
          <Text style={styles.sectionNote}>
            {batchesShown.length < summary.batches.length
              ? `Showing ${batchesShown.length} of ${summary.batches.length} active batches.`
              : `${batchesShown.length} active batch${batchesShown.length === 1 ? "" : "es"}.`}{" "}
            Mass-based figures are computed only over batches with a recorded weight.
          </Text>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow} fixed>
              <Text style={styles.tableHeaderCell}>Batch ID</Text>
              <Text style={styles.tableHeaderCell}>Manufacturer</Text>
              <Text style={styles.tableHeaderCell}>Mass (kg)</Text>
              <Text style={styles.tableHeaderCell}>PCR (kg)</Text>
              <Text style={styles.tableHeaderCell}>Gross</Text>
              <Text style={styles.tableHeaderCell}>Savings</Text>
              <Text style={styles.tableHeaderCell}>Net</Text>
              <Text style={styles.tableHeaderCell}>Valuation</Text>
            </View>
            {batchesShown.map((b) => (
              <View key={b.batchId} style={styles.tableRow} wrap={false}>
                <Text style={styles.tableCell}>{b.batchId}</Text>
                <Text style={styles.tableCell}>{b.manufacturerName ?? "—"}</Text>
                <Text style={styles.tableCell}>{b.hasWeightData ? b.batchMassKg.toLocaleString() : "—"}</Text>
                <Text style={styles.tableCell}>{b.hasWeightData ? b.pcrMassKg.toLocaleString() : "—"}</Text>
                <Text style={styles.tableCell}>{eur(b.grossLiabilityEur)}</Text>
                <Text style={styles.tableCell}>{eur(b.pcrTaxSavingsEur)}</Text>
                <Text style={styles.tableCell}>{eur(b.netLiabilityEur)}</Text>
                <Text style={styles.tableCell}>
                  {!b.hasWeightData ? "no weight data" : b.hasLockedValuation ? "Locked" : "Live estimate"}
                </Text>
              </View>
            ))}
            {batchesShown.length === 0 && (
              <View style={styles.tableRow}>
                <Text style={styles.tableCell}>No active batches on record.</Text>
              </View>
            )}
          </View>
          <View style={[styles.row, { marginTop: 8 }]}>
            <Text style={styles.label}>Portfolio Totals</Text>
            <Text style={styles.value}>
              Gross {eur(summary.totalGrossLiabilityEur)} · Savings {eur(summary.totalPcrTaxSavingsEur)} · Net{" "}
              {eur(summary.totalNetLiabilityEur)}
            </Text>
          </View>
        </View>

        {/* --- Third-Party Auditor Sign-Offs (Portfolio) --- */}
        <View style={styles.section} break>
          <Text style={styles.sectionTitle}>Third-Party Auditor Sign-Offs (Portfolio)</Text>
          <Text style={styles.sectionNote}>
            Most recent {signOffs.length} formal review decision{signOffs.length === 1 ? "" : "s"} across the
            portfolio, latest first. These sign-offs verify each batch&apos;s material/LCA claims — this schema has
            no concept of an auditor signing off on a tax valuation specifically, so this table is supporting
            portfolio context, not a tax-specific attestation.
          </Text>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow} fixed>
              <Text style={styles.tableHeaderCell}>Batch ID</Text>
              <Text style={styles.tableHeaderCell}>Auditor</Text>
              <Text style={styles.tableHeaderCell}>Decision</Text>
              <Text style={styles.tableHeaderCell}>Signed</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.4 }]}>Signature Hash</Text>
            </View>
            {signOffs.map((s, i) => (
              <View key={i} style={styles.tableRow} wrap={false}>
                <Text style={styles.tableCell}>{s.batchId}</Text>
                <Text style={styles.tableCell}>
                  {s.auditorName} ({s.auditorOrganization})
                </Text>
                <Text style={styles.tableCell}>{s.status === "AUDITOR_VERIFIED" ? "Verified" : "Rejected"}</Text>
                <Text style={styles.tableCell}>{new Date(s.signedAt).toLocaleDateString()}</Text>
                <Text style={[styles.tableCell, styles.mono, { flex: 1.4 }]}>{truncateHash(s.signatureHash)}</Text>
              </View>
            ))}
            {signOffs.length === 0 && (
              <View style={styles.tableRow}>
                <Text style={styles.tableCell}>No auditor sign-offs on record yet.</Text>
              </View>
            )}
          </View>
          {signOffs.length < signOffsTotal && (
            <Text style={styles.sectionNote}>
              Showing {signOffs.length} of {signOffsTotal} total sign-offs on record.
            </Text>
          )}
        </View>

        {/* --- Report Certification (printable sign-off block for this filing) --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Report Certification</Text>
          <Text style={styles.sectionNote}>
            For internal review and filing purposes — sign and date to certify this report was reviewed prior to
            submission.
          </Text>
          <View style={styles.signOffGrid}>
            <View style={styles.signOffCard}>
              <Text style={styles.signOffLabel}>Prepared By</Text>
              <View style={styles.signOffLine}>
                <Text style={styles.signOffCaption}>Signature / Date</Text>
              </View>
            </View>
            <View style={styles.signOffCard}>
              <Text style={styles.signOffLabel}>Reviewed By</Text>
              <View style={styles.signOffLine}>
                <Text style={styles.signOffCaption}>Signature / Date</Text>
              </View>
            </View>
            <View style={styles.signOffCard}>
              <Text style={styles.signOffLabel}>Approved By</Text>
              <View style={styles.signOffLine}>
                <Text style={styles.signOffCaption}>Signature / Date</Text>
              </View>
            </View>
          </View>
        </View>

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages} · Generated ${generatedAt} · Polymer DPP Green Tax & Plastic Packaging Compliance Report · Illustrative estimate, not tax or legal advice — see Portfolio Summary disclaimer.`
          }
        />
      </Page>
    </Document>
  );
}

export async function generateGreenTaxReportPdf(): Promise<Buffer> {
  const summary = await computePortfolioGreenAccounting();

  // Reuses the exact query shape generate-compliance-report-pdf.tsx uses
  // for its own "Third-Party Auditor Sign-Offs" table — same model, same
  // cap, same "latest first" ordering — so the two reports never disagree
  // about what a sign-off looked like.
  const [signOffsTotal, rawSignOffs] = await Promise.all([
    prisma.auditorVerification.count(),
    prisma.auditorVerification.findMany({
      orderBy: { signedAt: "desc" },
      take: MAX_SIGNOFF_ROWS,
      select: {
        status: true,
        signedAt: true,
        signatureHash: true,
        auditor: { select: { name: true, organization: true } },
        passport: { select: { batchId: true } },
      },
    }),
  ]);

  const signOffs: SignOffRow[] = rawSignOffs.map((s) => ({
    batchId: s.passport.batchId,
    auditorName: s.auditor.name,
    auditorOrganization: s.auditor.organization,
    status: s.status,
    signedAt: s.signedAt.toISOString(),
    signatureHash: s.signatureHash,
  }));

  return renderToBuffer(
    <GreenTaxReportDocument
      summary={summary}
      signOffs={signOffs}
      signOffsTotal={signOffsTotal}
      generatedAt={new Date().toLocaleString()}
    />
  );
}
