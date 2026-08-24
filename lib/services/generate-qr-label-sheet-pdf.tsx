/**
 * lib/services/generate-qr-label-sheet-pdf.tsx
 * -----------------------------------------------------------------------
 * Sprint 2.2 (Dynamic QR Code Engine & Factory Batch Labeling) — a
 * print-ready A4 sheet of per-batch QR labels, for a compounder to print
 * and physically apply to packaging. Mirrors
 * lib/services/generate-certificate-pdf.tsx's conventions exactly
 * (@react-pdf/renderer, StyleSheet, renderToBuffer → Buffer) so this stays
 * visually and structurally consistent with the existing PDF export rather
 * than introducing a second styling language.
 *
 * Each label's QR encodes the batch's already-persisted `qrCodePayloadUrl`
 * (the real GS1 Digital Link built by lib/qr.ts at passport creation —
 * see that file's banner) via lib/qr-image.ts. Deliberately a lean, narrow
 * `select` query (batchId/gtin/polymerType/grade/qrCodePayloadUrl only) —
 * a label sheet needs none of the full passport record.
 *
 * Pagination is manual (chunked into fixed-size pages), not react-pdf's
 * automatic flow-based pagination — this keeps every label's size and grid
 * position fully predictable, which matters for a document meant to be
 * printed and physically cut/applied, not just read on screen.
 */

import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { generateQrPngDataUrl } from "@/lib/qr-image";

const COLUMNS = 2;
const ROWS_PER_PAGE = 5;
const LABELS_PER_PAGE = COLUMNS * ROWS_PER_PAGE;

const styles = StyleSheet.create({
  page: { padding: 24, paddingBottom: 36, fontFamily: "Helvetica" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  labelCell: { width: `${100 / COLUMNS}%`, padding: 8 },
  labelCard: {
    border: "1 solid #cbd5e1",
    borderRadius: 4,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    height: 100,
  },
  qr: { width: 76, height: 76 },
  info: { flex: 1, paddingLeft: 10 },
  batchId: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  meta: { fontSize: 7.5, color: "#475569", marginTop: 3 },
  caption: { fontSize: 6.5, color: "#94a3b8", marginTop: 6 },
  footer: {
    position: "absolute",
    bottom: 14,
    left: 24,
    right: 24,
    fontSize: 6.5,
    color: "#94a3b8",
    textAlign: "center",
  },
});

interface LabelData {
  batchId: string;
  gtin: string;
  polymerType: string;
  grade: string;
  qrDataUrl: string;
}

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

function LabelSheetDocument({ labels, generatedAt }: { labels: LabelData[]; generatedAt: string }) {
  const pages = chunk(labels, LABELS_PER_PAGE);

  return (
    <Document>
      {pages.map((pageLabels, pageIndex) => (
        <Page key={pageIndex} size="A4" style={styles.page}>
          <View style={styles.grid}>
            {pageLabels.map((label) => (
              <View key={label.batchId} style={styles.labelCell}>
                <View style={styles.labelCard}>
                  <Image src={label.qrDataUrl} style={styles.qr} />
                  <View style={styles.info}>
                    <Text style={styles.batchId}>{label.batchId}</Text>
                    <Text style={styles.meta}>
                      {label.polymerType} · {label.grade}
                    </Text>
                    <Text style={styles.meta}>GTIN {label.gtin}</Text>
                    <Text style={styles.caption}>Scan to verify · Polymer DPP</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
          <Text style={styles.footer}>
            Generated {generatedAt} · Polymer DPP factory batch labels · Page {pageIndex + 1} of {pages.length}
          </Text>
        </Page>
      ))}
    </Document>
  );
}

/**
 * Generates the label sheet PDF for the given batch IDs. Returns null if
 * none of the requested batch IDs matched a passport with a recorded QR
 * link (e.g. a very old batch created before qrCodePayloadUrl existed, or
 * simply a bad batchId) — the API route turns that into a 404, same
 * convention as generateCertificatePdf().
 */
export async function generateQrLabelSheetPdf(batchIds: string[]): Promise<Buffer | null> {
  if (batchIds.length === 0) return null;

  const passports = await prisma.polymerPassport.findMany({
    where: { batchId: { in: batchIds } },
    select: {
      batchId: true,
      gtin: true,
      polymerType: true,
      grade: true,
      qrCodePayloadUrl: true,
    },
  });

  const withLinks = passports.filter(
    (p): p is typeof p & { qrCodePayloadUrl: string } => !!p.qrCodePayloadUrl
  );
  if (withLinks.length === 0) return null;

  const labels: LabelData[] = await Promise.all(
    withLinks.map(async (p) => ({
      batchId: p.batchId,
      gtin: p.gtin,
      polymerType: p.polymerType,
      grade: p.grade,
      qrDataUrl: await generateQrPngDataUrl(p.qrCodePayloadUrl),
    }))
  );

  return renderToBuffer(<LabelSheetDocument labels={labels} generatedAt={new Date().toLocaleString()} />);
}
