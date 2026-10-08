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
 *
 * Phase 6 (Batch Certificate & Dynamic QR Generator Suite) additions:
 *   - `layout`: "grid" (the original 2x5-per-A4-page sheet, unchanged
 *     default — small labels for a page a compounder cuts apart by hand)
 *     or "large" (1x3-per-page, a bigger QR + larger batch-ID type, sized
 *     for a manufacturing-line thermal/industrial label printer where
 *     each label is fed and cut individually rather than hand-trimmed
 *     from a shared sheet).
 *   - `copiesPerBatch`: repeats each selected batch's label N times
 *     (capped — see MAX_COPIES_PER_BATCH) so one pass covers printing
 *     multiple physical units/drums/pallets from the same batch, instead
 *     of requiring N separate exports.
 * Both are optional and default to the pre-Phase-6 behavior (grid, 1
 * copy) — an existing caller (the "Print Labels" toolbar button, unaware
 * of these new params) gets byte-identical output to before.
 */

import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { generateQrPngDataUrl } from "@/lib/qr-image";

export type LabelSheetLayout = "grid" | "large";

export const MAX_COPIES_PER_BATCH = 20;

const GRID_COLUMNS = 2;
const GRID_ROWS_PER_PAGE = 5;
const LARGE_COLUMNS = 1;
const LARGE_ROWS_PER_PAGE = 3;

const styles = StyleSheet.create({
  page: { padding: 24, paddingBottom: 36, fontFamily: "Helvetica" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  // --- "grid" layout: small labels, many per page ---------------------------
  labelCell: { width: `${100 / GRID_COLUMNS}%`, padding: 8 },
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
  // --- "large" layout: fewer, bigger labels for industrial/thermal print ---
  labelCellLarge: { width: `${100 / LARGE_COLUMNS}%`, padding: 12 },
  labelCardLarge: {
    border: "2 solid #0f172a",
    borderRadius: 8,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    height: 190,
  },
  qrLarge: { width: 150, height: 150 },
  infoLarge: { flex: 1, paddingLeft: 20 },
  batchIdLarge: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  metaLarge: { fontSize: 13, color: "#334155", marginTop: 6 },
  captionLarge: { fontSize: 10, color: "#64748b", marginTop: 12 },
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

function LabelSheetDocument({
  labels,
  layout,
  generatedAt,
}: {
  labels: LabelData[];
  layout: LabelSheetLayout;
  generatedAt: string;
}) {
  const labelsPerPage = layout === "large" ? LARGE_COLUMNS * LARGE_ROWS_PER_PAGE : GRID_COLUMNS * GRID_ROWS_PER_PAGE;
  const pages = chunk(labels, labelsPerPage);

  return (
    <Document>
      {pages.map((pageLabels, pageIndex) => (
        <Page key={pageIndex} size="A4" style={styles.page}>
          <View style={styles.grid}>
            {pageLabels.map((label, i) =>
              layout === "large" ? (
                <View key={`${label.batchId}-${i}`} style={styles.labelCellLarge}>
                  <View style={styles.labelCardLarge}>
                    <Image src={label.qrDataUrl} style={styles.qrLarge} />
                    <View style={styles.infoLarge}>
                      <Text style={styles.batchIdLarge}>{label.batchId}</Text>
                      <Text style={styles.metaLarge}>
                        {label.polymerType} · {label.grade}
                      </Text>
                      <Text style={styles.metaLarge}>GTIN {label.gtin}</Text>
                      <Text style={styles.captionLarge}>Scan to verify · DPP-Polymer</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View key={`${label.batchId}-${i}`} style={styles.labelCell}>
                  <View style={styles.labelCard}>
                    <Image src={label.qrDataUrl} style={styles.qr} />
                    <View style={styles.info}>
                      <Text style={styles.batchId}>{label.batchId}</Text>
                      <Text style={styles.meta}>
                        {label.polymerType} · {label.grade}
                      </Text>
                      <Text style={styles.meta}>GTIN {label.gtin}</Text>
                      <Text style={styles.caption}>Scan to verify · DPP-Polymer</Text>
                    </View>
                  </View>
                </View>
              )
            )}
          </View>
          <Text style={styles.footer}>
            Generated {generatedAt} · DPP-Polymer factory batch labels ({layout === "large" ? "industrial" : "standard"} layout) · Page{" "}
            {pageIndex + 1} of {pages.length}
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
 *
 * `layout` defaults to "grid" and `copiesPerBatch` defaults to 1 —
 * pre-Phase-6 callers that don't pass either option get the exact same
 * output as before. `copiesPerBatch` is clamped to
 * [1, MAX_COPIES_PER_BATCH] rather than trusting the caller, since this
 * is reachable from a public GET route (see this file's own banner on why
 * that's an accepted, deliberate choice) and an unbounded multiplier
 * would let one request render an unbounded number of QR images.
 */
export async function generateQrLabelSheetPdf(
  batchIds: string[],
  options: { layout?: LabelSheetLayout; copiesPerBatch?: number } = {}
): Promise<Buffer | null> {
  if (batchIds.length === 0) return null;
  const layout: LabelSheetLayout = options.layout === "large" ? "large" : "grid";
  const copiesPerBatch = Math.min(Math.max(Math.floor(options.copiesPerBatch ?? 1), 1), MAX_COPIES_PER_BATCH);

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

  // One QR render per distinct batch, regardless of copiesPerBatch — the
  // image is identical across copies of the same batch, so there's no
  // reason to re-render it N times.
  const uniqueLabels: LabelData[] = await Promise.all(
    withLinks.map(async (p) => ({
      batchId: p.batchId,
      gtin: p.gtin,
      polymerType: p.polymerType,
      grade: p.grade,
      qrDataUrl: await generateQrPngDataUrl(p.qrCodePayloadUrl, { size: layout === "large" ? 450 : 300 }),
    }))
  );

  const labels: LabelData[] =
    copiesPerBatch === 1 ? uniqueLabels : uniqueLabels.flatMap((label) => Array(copiesPerBatch).fill(label));

  return renderToBuffer(<LabelSheetDocument labels={labels} layout={layout} generatedAt={new Date().toLocaleString()} />);
}
