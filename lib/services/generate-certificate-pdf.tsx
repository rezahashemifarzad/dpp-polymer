/**
 * lib/services/generate-certificate-pdf.tsx
 * -----------------------------------------------------------------------
 * Server-side "Certificate of Conformity" PDF export (Circular Economy
 * Platform Upgrade, Step 4 §3). Reuses lib/verifyPassport.ts's
 * getVerifiedPassport — the exact same data + live integrity re-check that
 * powers the public scan page — so the PDF can never show a different
 * story than the web view for the same batch.
 *
 * Renders with @react-pdf/renderer's Node API (renderToStream), collected
 * into a Buffer here so the API route can hand it straight to NextResponse
 * without dealing with Node-stream-to-web-stream conversion.
 *
 * Certification rows are filtered to verificationStatus === "VERIFIED",
 * mirroring the same rule just applied to the public scan page — a
 * PENDING_REVIEW or REJECTED certification must never appear on a document
 * literally titled "Certificate of Conformity".
 */

import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { getVerifiedPassport } from "@/lib/verifyPassport";

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
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  subtitle: { fontSize: 9, color: "#64748b", marginTop: 2 },
  badge: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 3,
  },
  badgeVerified: { backgroundColor: "#d1fae5", color: "#065f46" },
  badgeUnverified: { backgroundColor: "#fee2e2", color: "#991b1b" },
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: "42%", color: "#64748b" },
  value: { width: "58%", fontFamily: "Helvetica-Bold", color: "#0f172a" },
  table: { borderTop: "1 solid #e2e8f0" },
  tableRow: { flexDirection: "row", borderBottom: "1 solid #e2e8f0", paddingVertical: 5 },
  tableCell: { flex: 1, paddingRight: 6 },
  mono: { fontFamily: "Courier", fontSize: 8, color: "#475569" },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: "1 solid #e2e8f0",
    paddingTop: 8,
    fontSize: 7.5,
    color: "#94a3b8",
  },
});

interface CertificationRow {
  scheme: string;
  certificateId: string;
  issuingBody: string;
  validUntil: Date;
}

interface GenealogyRow {
  batchId: string;
  polymerType: string;
  grade: string;
  quantityUsedKg: number | null;
}

function CertificateDocument({
  batchId,
  gtin,
  polymerType,
  grade,
  manufacturerName,
  manufacturerCountry,
  productionDate,
  status,
  meltFlowIndex,
  mfiTestStandard,
  density,
  densityTestStandard,
  recycledContentPercent,
  bioBasedPercent,
  carbonFootprintKgCO2ePerKg,
  lcaMethodology,
  lcaThirdPartyVerified,
  carbonEstimate,
  certifications,
  genealogy,
  recordHash,
  hashAlgorithm,
  integrityVerified,
  generatedAt,
}: {
  batchId: string;
  gtin: string;
  polymerType: string;
  grade: string;
  manufacturerName: string;
  manufacturerCountry: string;
  productionDate: string;
  status: string;
  meltFlowIndex: number;
  mfiTestStandard: string;
  density: number;
  densityTestStandard: string;
  recycledContentPercent: number;
  bioBasedPercent: number;
  carbonFootprintKgCO2ePerKg: number;
  lcaMethodology: string;
  lcaThirdPartyVerified: boolean;
  carbonEstimate: { totalKgCO2e: number; emissionFactorVersion: string } | null;
  certifications: CertificationRow[];
  genealogy: GenealogyRow[];
  recordHash: string | null;
  hashAlgorithm: string;
  integrityVerified: boolean;
  generatedAt: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Certificate of Conformity</Text>
            <Text style={styles.subtitle}>Digital Product Passport — Batch {batchId}</Text>
          </View>
          <Text style={[styles.badge, integrityVerified ? styles.badgeVerified : styles.badgeUnverified]}>
            {integrityVerified ? "Integrity Verified" : "Integrity Unverified"}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Product Identification</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Polymer Type / Grade</Text>
            <Text style={styles.value}>{polymerType} · {grade}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>GTIN</Text>
            <Text style={styles.value}>{gtin}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Batch ID</Text>
            <Text style={styles.value}>{batchId}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Manufacturer</Text>
            <Text style={styles.value}>{manufacturerName} ({manufacturerCountry})</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Production Date</Text>
            <Text style={styles.value}>{new Date(productionDate).toLocaleDateString()}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Passport Status</Text>
            <Text style={styles.value}>{status}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Technical Properties</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Melt Flow Index</Text>
            <Text style={styles.value}>{meltFlowIndex} g/10min ({mfiTestStandard})</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Density</Text>
            <Text style={styles.value}>{density} g/cm³ ({densityTestStandard})</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sustainability &amp; Carbon Footprint</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Recycled Content</Text>
            <Text style={styles.value}>{recycledContentPercent}%</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Bio-Based Content</Text>
            <Text style={styles.value}>{bioBasedPercent}%</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Verified LCA Carbon Footprint</Text>
            <Text style={styles.value}>
              {carbonFootprintKgCO2ePerKg} kg CO2e/kg ({lcaMethodology}
              {lcaThirdPartyVerified ? ", third-party verified" : ""})
            </Text>
          </View>
          {carbonEstimate && (
            <View style={styles.row}>
              <Text style={styles.label}>Illustrative Scope 1/2/3 Estimate</Text>
              <Text style={styles.value}>
                {carbonEstimate.totalKgCO2e} kg CO2e total ({carbonEstimate.emissionFactorVersion})
              </Text>
            </View>
          )}
        </View>

        {certifications.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Verified Certifications</Text>
            <View style={styles.table}>
              {certifications.map((c, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{c.scheme}</Text>
                  <Text style={styles.tableCell}>{c.certificateId}</Text>
                  <Text style={styles.tableCell}>{c.issuingBody}</Text>
                  <Text style={styles.tableCell}>Valid until {new Date(c.validUntil).toLocaleDateString()}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {genealogy.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upstream Batch Genealogy</Text>
            <View style={styles.table}>
              {genealogy.map((g, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{g.batchId}</Text>
                  <Text style={styles.tableCell}>{g.polymerType} · {g.grade}</Text>
                  <Text style={styles.tableCell}>{g.quantityUsedKg ? `${g.quantityUsedKg} kg used` : "—"}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cryptographic Integrity</Text>
          <Text style={styles.mono}>
            {hashAlgorithm} recordHash: {recordHash ?? "not yet signed"}
          </Text>
        </View>

        <Text style={styles.footer}>
          Generated {generatedAt} · This document is a point-in-time export of the live Digital Product
          Passport for batch {batchId}. The recordHash above was independently re-verified against the
          stored data at generation time. For the current live record and QR verification, resolve
          /01/{gtin}/21/{batchId} via GS1 Digital Link.
        </Text>
      </Page>
    </Document>
  );
}

export async function generateCertificatePdf(batchId: string): Promise<Buffer | null> {
  const result = await getVerifiedPassport(batchId);
  if (!result) return null;
  const { passport, integrityVerified } = result;

  const verifiedCertifications = passport.certifications
    .filter((c) => c.verificationStatus === "VERIFIED")
    .map((c) => ({
      scheme: c.scheme,
      certificateId: c.certificateId,
      issuingBody: c.issuingBody,
      validUntil: c.validUntil,
    }));

  const genealogy = passport.parentLinks.map((link) => ({
    batchId: link.parentPassport.batchId,
    polymerType: link.parentPassport.polymerType,
    grade: link.parentPassport.grade,
    quantityUsedKg: link.quantityUsedKg !== null ? Number(link.quantityUsedKg) : null,
  }));

  const carbonEstimate = passport.carbonFootprintCalculation
    ? {
        totalKgCO2e: Number(passport.carbonFootprintCalculation.totalKgCO2e),
        emissionFactorVersion: passport.carbonFootprintCalculation.emissionFactorVersion,
      }
    : null;

  // renderToBuffer (not the deprecated renderToStream) — resolves directly
  // to a Node Buffer, which NextResponse can hand back as the response
  // body with no manual stream-collection step.
  return renderToBuffer(
    <CertificateDocument
      batchId={passport.batchId}
      gtin={passport.gtin}
      polymerType={passport.polymerType}
      grade={passport.grade}
      manufacturerName={passport.manufacturer.legalName}
      manufacturerCountry={passport.manufacturer.country}
      productionDate={passport.productionDate.toISOString()}
      status={passport.status}
      meltFlowIndex={Number(passport.meltFlowIndex)}
      mfiTestStandard={passport.mfiTestStandard}
      density={Number(passport.density)}
      densityTestStandard={passport.densityTestStandard}
      recycledContentPercent={Number(passport.recycledContentPercent)}
      bioBasedPercent={Number(passport.bioBasedPercent)}
      carbonFootprintKgCO2ePerKg={Number(passport.carbonFootprintKgCO2ePerKg)}
      lcaMethodology={passport.lcaMethodology}
      lcaThirdPartyVerified={passport.lcaThirdPartyVerified}
      carbonEstimate={carbonEstimate}
      certifications={verifiedCertifications}
      genealogy={genealogy}
      recordHash={passport.recordHash}
      hashAlgorithm={passport.hashAlgorithm}
      integrityVerified={integrityVerified}
      generatedAt={new Date().toISOString()}
    />
  );
}
