/**
 * lib/services/generate-compliance-report-pdf.tsx
 * -----------------------------------------------------------------------
 * Sprint 2.3 (Enterprise Compliance Reporting & PDF/Excel Export Module) —
 * the "Official PDF Export": a portfolio-wide EU ESPR 2026 compliance
 * report, distinct from the existing per-batch
 * generate-certificate-pdf.tsx's "Certificate of Conformity" (that one
 * proves a single batch; this one summarizes the whole ledger for an
 * auditor or regulator).
 *
 * Reuses lib/services/esg-analytics.ts's getEsgAnalytics() for every
 * aggregate figure (PCR mass, carbon, tax relief, certification
 * compliance) rather than re-deriving them — the PDF must never show a
 * number that disagrees with the ESG Analytics dashboard for the same
 * portfolio, "compute, don't store" carried over from that service's own
 * banner.
 *
 * Styled to match generate-certificate-pdf.tsx's exact @react-pdf/renderer
 * conventions (same StyleSheet color values, same Helvetica/Courier
 * fonts, same row/label/value pattern) — this repo's one established PDF
 * design language — rather than introducing a second visual style.
 *
 * Four data sections beyond the ESG summary:
 *   - "Sustainability Readiness Index" (Phase 5 addition): the composite
 *     score + per-component breakdown from esg.readinessIndex, compact
 *     form (score/weight/detail per row) matching this PDF's existing
 *     row/label/value pattern.
 *   - "PPWR Regulatory Target Compliance" (Phase 5 addition): the 2030/
 *     2040 recycled-content target comparison from
 *     esg.regulatoryCompliance, same table style as the batch register
 *     below.
 *   - "Batch Tracking Register": every active batch (REVOKED/SUPERSEDED
 *     excluded, matching esg-analytics.ts's own EXCLUDED_STATUSES), most
 *     recently produced first, capped at MAX_BATCH_ROWS with an explicit
 *     "showing N of M" note if truncated (never a silent cap).
 *   - "Third-Party Auditor Sign-Offs": the most recent formal
 *     AuditorVerification decisions across the whole portfolio (not just
 *     one batch's latest, unlike the certificate PDF). Deliberately omits
 *     AuditorVerification.notes — per that model's own schema comment,
 *     notes are "Admin+portal-only... never surfaced on the public
 *     passport page," and this report follows the same rule.
 *
 * Unlike the single-batch certificate (which always fits one page), this
 * document can span many pages — content is left to react-pdf's automatic
 * pagination (a <Page>'s children simply flow onto additional pages of
 * the same size/style when they overflow), and the footer uses `fixed` +
 * a `render` callback so "Page X of Y" is correct on every page rather
 * than only the first.
 */

import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { DppStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getEsgAnalytics, type EsgAnalyticsSummary } from "@/lib/services/esg-analytics";

const MAX_BATCH_ROWS = 300;
const MAX_SIGNOFF_ROWS = 40;

// Mirrors esg-analytics.ts's own EXCLUDED_STATUSES exactly — a REVOKED
// passport's claims are withdrawn and a SUPERSEDED one has been replaced,
// so neither belongs in a report whose numbers must agree with the ESG
// Analytics dashboard for the same portfolio.
const EXCLUDED_STATUSES: DppStatus[] = ["REVOKED", "SUPERSEDED"];

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
    backgroundColor: "#d1fae5",
    color: "#065f46",
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
  kpiCard: {
    width: "25%",
    paddingHorizontal: 6,
    marginBottom: 10,
  },
  kpiLabel: { fontSize: 7, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4 },
  kpiValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#0f172a", marginTop: 2 },
  kpiSub: { fontSize: 7, color: "#94a3b8", marginTop: 1 },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: "42%", color: "#64748b" },
  value: { width: "58%", fontFamily: "Helvetica-Bold", color: "#0f172a" },
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
  disclaimer: {
    fontSize: 7.5,
    color: "#94a3b8",
    marginTop: 4,
    lineHeight: 1.4,
  },
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

interface BatchRow {
  batchId: string;
  polymerType: string;
  grade: string;
  status: string;
  manufacturerName: string;
  recycledContentPercent: number;
  carbonFootprintKgCO2ePerKg: number;
  productionDate: string;
}

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

function ComplianceReportDocument({
  esg,
  batches,
  batchesTotal,
  signOffs,
  generatedAt,
}: {
  esg: EsgAnalyticsSummary;
  batches: BatchRow[];
  batchesTotal: number;
  signOffs: SignOffRow[];
  generatedAt: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.brand}>POLYMER DPP</Text>
            <Text style={styles.title}>EU ESPR 2026 Compliance Report</Text>
            <Text style={styles.subtitle}>Portfolio Sustainability &amp; Traceability Summary</Text>
          </View>
          <Text style={styles.badge}>ESPR 2026</Text>
        </View>

        {/* --- Portfolio Summary (from lib/services/esg-analytics.ts) --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Portfolio Summary</Text>
          <View style={styles.kpiGrid}>
            <KpiCard
              label="Active Batches"
              value={String(esg.activeBatches)}
              sub={`${esg.totalBatches} total, ${esg.excludedBatches} excluded`}
            />
            <KpiCard
              label="PCR Mass Consumed"
              value={`${esg.pcrMass.pcrMassKg.toLocaleString()} kg`}
              sub={`${esg.pcrMass.pcrAdoptionRatePercent}% of weighed mass`}
            />
            <KpiCard
              label="Verified Carbon Footprint"
              value={esg.carbon.totalVerifiedKgCO2e !== null ? `${esg.carbon.totalVerifiedKgCO2e.toLocaleString()} kg CO2e` : "n/a"}
              sub={
                esg.carbon.avgVerifiedIntensityKgCO2ePerKg !== null
                  ? `avg ${esg.carbon.avgVerifiedIntensityKgCO2ePerKg} kg CO2e/kg`
                  : undefined
              }
            />
            <KpiCard
              label="Certification Compliance"
              value={`${esg.compliance.verifiedPercent}%`}
              sub={`${esg.compliance.verified} of ${esg.compliance.totalCertifications} verified`}
            />
          </View>
          <Text style={styles.disclaimer}>
            Mass-based metrics (PCR mass, tax relief, verified carbon totals) are computed only over the{" "}
            {esg.pcrMass.batchesWithWeightData} of {esg.pcrMass.batchesConsidered} active batches with a recorded
            weight. Illustrative carbon estimates use placeholder emission factors and are shown separately from
            verified LCA figures. Est. EU Plastic Tax Relief (€{esg.taxRelief.ratePerTonneEur}/tonne on{" "}
            {esg.taxRelief.pcrMassTonnes} t PCR = €{esg.taxRelief.estimatedReliefEur.toLocaleString()}) is
            illustrative only, not tax or legal advice — {esg.taxRelief.disclaimer}
          </Text>
        </View>

        {/* --- Sustainability Readiness Index (Phase 5) --- */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Sustainability Readiness Index</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Overall Score</Text>
            <Text style={styles.value}>{esg.readinessIndex.overallScore} / 100 — {esg.readinessIndex.rating}</Text>
          </View>
          {esg.readinessIndex.components.map((c) => (
            <View style={styles.row} key={c.key}>
              <Text style={styles.label}>{c.label} ({Math.round(c.weight * 100)}% weight)</Text>
              <Text style={styles.value}>{c.score} / 100</Text>
            </View>
          ))}
          <Text style={styles.disclaimer}>{esg.readinessIndex.methodologyNote}</Text>
        </View>

        {/* --- PPWR Regulatory Target Compliance (Phase 5) --- */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>PPWR Regulatory Target Compliance</Text>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={styles.tableHeaderCell}>Category</Text>
              <Text style={styles.tableHeaderCell}>Year</Text>
              <Text style={styles.tableHeaderCell}>Target %</Text>
              <Text style={styles.tableHeaderCell}>Actual %</Text>
              <Text style={styles.tableHeaderCell}>Gap (pp)</Text>
              <Text style={styles.tableHeaderCell}>Status</Text>
            </View>
            {esg.regulatoryCompliance.targets.map((t) => (
              <View style={styles.tableRow} key={t.year}>
                <Text style={styles.tableCell}>{t.category}</Text>
                <Text style={styles.tableCell}>{t.year}</Text>
                <Text style={styles.tableCell}>{t.targetPercent}%</Text>
                <Text style={styles.tableCell}>{t.actualPercent}%</Text>
                <Text style={styles.tableCell}>{t.gapPercentagePoints >= 0 ? "+" : ""}{t.gapPercentagePoints}</Text>
                <Text style={styles.tableCell}>{t.onTrack ? "On Track" : "Below Target"}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.disclaimer}>{esg.regulatoryCompliance.disclaimer}</Text>
        </View>

        {/* --- Batch Tracking Register --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Batch Tracking Register</Text>
          <Text style={styles.sectionNote}>
            {batches.length < batchesTotal
              ? `Showing ${batches.length} of ${batchesTotal} active batches, most recently produced first.`
              : `${batches.length} active batch${batches.length === 1 ? "" : "es"}, most recently produced first.`}
          </Text>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow} fixed>
              <Text style={styles.tableHeaderCell}>Batch ID</Text>
              <Text style={styles.tableHeaderCell}>Polymer / Grade</Text>
              <Text style={styles.tableHeaderCell}>Manufacturer</Text>
              <Text style={styles.tableHeaderCell}>Recycled %</Text>
              <Text style={styles.tableHeaderCell}>Carbon (kg/kg)</Text>
              <Text style={styles.tableHeaderCell}>Status</Text>
            </View>
            {batches.map((b) => (
              <View key={b.batchId} style={styles.tableRow} wrap={false}>
                <Text style={styles.tableCell}>{b.batchId}</Text>
                <Text style={styles.tableCell}>
                  {b.polymerType} · {b.grade}
                </Text>
                <Text style={styles.tableCell}>{b.manufacturerName}</Text>
                <Text style={styles.tableCell}>{b.recycledContentPercent}%</Text>
                <Text style={styles.tableCell}>{b.carbonFootprintKgCO2ePerKg || "—"}</Text>
                <Text style={styles.tableCell}>{b.status}</Text>
              </View>
            ))}
            {batches.length === 0 && (
              <View style={styles.tableRow}>
                <Text style={styles.tableCell}>No active batches on record.</Text>
              </View>
            )}
          </View>
        </View>

        {/* --- Third-Party Auditor Sign-Offs --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Third-Party Auditor Sign-Offs</Text>
          <Text style={styles.sectionNote}>
            Most recent {signOffs.length} formal review decision{signOffs.length === 1 ? "" : "s"} across the
            portfolio, latest first. Each row is an individually signed, tamper-evident record — see
            signatureHash.
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
                <Text style={styles.tableCell}>
                  {s.status === "AUDITOR_VERIFIED" ? "Verified" : "Rejected"}
                </Text>
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
        </View>

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages} · Generated ${generatedAt} · Polymer DPP EU ESPR 2026 Compliance Report · Portfolio point-in-time export, not a substitute for live GS1 Digital Link verification of any individual batch.`
          }
        />
      </Page>
    </Document>
  );
}

export async function generateComplianceReportPdf(): Promise<Buffer> {
  const esg = await getEsgAnalytics();

  const [batchesTotal, rawBatches, rawSignOffs] = await Promise.all([
    prisma.polymerPassport.count({ where: { status: { notIn: EXCLUDED_STATUSES } } }),
    prisma.polymerPassport.findMany({
      where: { status: { notIn: EXCLUDED_STATUSES } },
      orderBy: { productionDate: "desc" },
      take: MAX_BATCH_ROWS,
      select: {
        batchId: true,
        polymerType: true,
        grade: true,
        status: true,
        recycledContentPercent: true,
        carbonFootprintKgCO2ePerKg: true,
        productionDate: true,
        manufacturer: { select: { legalName: true } },
      },
    }),
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

  const batches: BatchRow[] = rawBatches.map((b) => ({
    batchId: b.batchId,
    polymerType: b.polymerType,
    grade: b.grade,
    status: b.status,
    manufacturerName: b.manufacturer?.legalName ?? "—",
    recycledContentPercent: Number(b.recycledContentPercent),
    carbonFootprintKgCO2ePerKg: Number(b.carbonFootprintKgCO2ePerKg),
    productionDate: b.productionDate.toISOString(),
  }));

  const signOffs: SignOffRow[] = rawSignOffs.map((s) => ({
    batchId: s.passport.batchId,
    auditorName: s.auditor.name,
    auditorOrganization: s.auditor.organization,
    status: s.status,
    signedAt: s.signedAt.toISOString(),
    signatureHash: s.signatureHash,
  }));

  return renderToBuffer(
    <ComplianceReportDocument
      esg={esg}
      batches={batches}
      batchesTotal={batchesTotal}
      signOffs={signOffs}
      generatedAt={new Date().toLocaleString()}
    />
  );
}
