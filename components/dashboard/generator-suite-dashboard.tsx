"use client";

// FIX (round 4 — language selector didn't translate admin pages): this
// dashboard's own header (title + subtitle) translated via
// lib/i18n/app-dictionary.ts — see that file's banner for scope.
import { useLanguage } from "@/lib/hooks/use-language";

/**
 * components/dashboard/generator-suite-dashboard.tsx
 * -----------------------------------------------------------------------
 * Phase 6 (Batch Certificate & Dynamic QR Generator Suite) — the client
 * dashboard behind /admin/generator. A searchable batch picker feeding a
 * live preview + two export actions:
 *   - "Download Certificate PDF" — single batch, GET
 *     /api/passports/{batchId}/certificate.pdf (pre-existing route,
 *     unchanged this phase; see lib/services/generate-certificate-pdf.tsx
 *     for the QR-embedding work Phase 6 added to it).
 *   - "Download Label Sheet PDF" — bulk, GET
 *     /api/passports/label-sheet.pdf?batchIds=...&layout=...&copiesPerBatch=...
 *     (see lib/services/generate-qr-label-sheet-pdf.tsx for the `layout`
 *     ("grid" | "large") and `copiesPerBatch` customization Phase 6 added).
 *
 * `?batchId=...` optionally pre-selects and focuses one batch on load —
 * the deep-link target used by BatchDetailsModal's "Open Generator Suite"
 * button (components/dashboard/batch-details-modal.tsx), so "manage this
 * one batch" hands off cleanly into "print/certify this one batch"
 * without the admin re-searching the full ledger for it. Applied exactly
 * once (via appliedDeepLink ref) so it doesn't fight a user's own later
 * selection changes.
 *
 * Deliberately does NOT import anything from
 * lib/services/generate-qr-label-sheet-pdf.tsx — that file pulls in
 * `prisma` and `@react-pdf/renderer`, both server-only; a client component
 * importing it would leak server code (and DB access) into the browser
 * bundle. MAX_COPIES_PER_BATCH / MAX_LABELS_PER_SHEET below are therefore
 * local mirrors of that file's/the API route's own limits — the same
 * client/server constant-duplication convention already used by
 * qr-label-sheet-modal.tsx's own MAX_LABELS_PER_SHEET and the
 * label-sheet.pdf route's MAX_BATCHES_PER_SHEET. The server clamps
 * authoritatively either way (see generateQrLabelSheetPdf's own comment),
 * so a stale local constant can only ever be too conservative, never
 * unsafe.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  LayoutGrid,
  Search,
  CheckSquare,
  Square,
  Printer,
  FileBadge,
  Download,
  Loader2,
  AlertTriangle,
  Layers,
  Rows3,
  Square as SquareIcon,
} from "lucide-react";
import { usePassports, type ApiPassport } from "@/lib/hooks/use-passports";
import { useToast } from "@/lib/hooks/use-toast";

type SheetLayout = "grid" | "large";

// Mirrors lib/services/generate-qr-label-sheet-pdf.tsx's own
// MAX_COPIES_PER_BATCH and the label-sheet.pdf route's
// MAX_BATCHES_PER_SHEET — see this file's banner for why these are local
// constants rather than an import.
const MAX_COPIES_PER_BATCH = 20;
const MAX_LABELS_PER_SHEET = 200;

const LAYOUT_OPTIONS: { value: SheetLayout; label: string; description: string; perPage: number }[] = [
  {
    value: "grid",
    label: "ui.gen.standardGrid",
    description: "ui.gen.25LabelsPerA4Sheet",
    perPage: 10,
  },
  {
    value: "large",
    label: "ui.gen.largeIndustrial",
    description: "ui.gen.13LabelsPerA4Sheet",
    perPage: 3,
  },
];

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function GeneratorSuiteDashboard() {
  const { t } = useLanguage();
  const { data: passports, loading } = usePassports();
  const { push } = useToast();
  const searchParams = useSearchParams();
  const deepLinkBatchId = searchParams.get("batchId");
  const appliedDeepLink = useRef(false);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set()); // keyed by passport.id
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [layout, setLayout] = useState<SheetLayout>("grid");
  const [copiesPerBatch, setCopiesPerBatch] = useState(1);
  const [preparingSheet, setPreparingSheet] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  // Apply the ?batchId= deep link exactly once, as soon as the matching
  // passport has loaded.
  useEffect(() => {
    if (appliedDeepLink.current || !deepLinkBatchId || passports.length === 0) return;
    const match = passports.find((p) => p.batchId === deepLinkBatchId);
    if (match) {
      setFocusedId(match.id);
      setSelected(new Set([match.id]));
      appliedDeepLink.current = true;
    }
  }, [passports, deepLinkBatchId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return passports;
    return passports.filter(
      (p) =>
        p.batchId.toLowerCase().includes(q) ||
        p.grade.toLowerCase().includes(q) ||
        p.polymerType.toLowerCase().includes(q) ||
        p.gtin.toLowerCase().includes(q)
    );
  }, [passports, search]);

  const focusedPassport: ApiPassport | null = useMemo(
    () => passports.find((p) => p.id === focusedId) ?? null,
    [passports, focusedId]
  );

  const selectedEligible = useMemo(
    () => passports.filter((p) => selected.has(p.id) && !!p.qrCodePayloadUrl),
    [passports, selected]
  );
  const selectedMissingQr = selected.size - selectedEligible.length;

  const totalLabels = selectedEligible.length * copiesPerBatch;
  const activeLayout = LAYOUT_OPTIONS.find((l) => l.value === layout)!;
  const estimatedPages = totalLabels === 0 ? 0 : Math.ceil(totalLabels / activeLayout.perPage);

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function focusRow(p: ApiPassport) {
    setFocusedId(p.id);
    if (!selected.has(p.id)) {
      setSelected((prev) => new Set(prev).add(p.id));
    }
  }

  function selectAllFiltered() {
    setSelected(new Set(filtered.slice(0, MAX_LABELS_PER_SHEET).map((p) => p.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function handleDownloadLabelSheet() {
    if (selectedEligible.length === 0) return;
    setSheetError(null);
    setPreparingSheet(true);
    try {
      const params = new URLSearchParams({
        batchIds: selectedEligible.map((p) => p.batchId).join(","),
        layout,
        copiesPerBatch: String(copiesPerBatch),
      });
      const res = await fetch(`/api/passports/label-sheet.pdf?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || t("ui.audit.requestFailedWithStatus", { v0: res.status }));
      }
      const blob = await res.blob();
      triggerBlobDownload(blob, `dpp-batch-labels-${selectedEligible.length}-${layout}.pdf`);
      push({
        variant: "success",
        title: t("ui.gen.labelSheetGenerated"),
        description: t("ui.gen.labelSAcrossA4PageS", { v0: totalLabels, v1: estimatedPages, v2: t(activeLayout.label) }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate label sheet";
      setSheetError(message);
      push({ variant: "error", title: t("ui.gen.labelSheetGenerationFailed"), description: message });
    } finally {
      setPreparingSheet(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans">
      {/* Bug fix — top offset bumped from 0 to the shared admin-offset
          token (SiteNav's 3.5rem + the admin sign-out bar's 2rem — see
          app/admin/layout.tsx's own comment and the
          --admin-content-offset definition in app/globals.css) now that
          both of those are sticky too; top-0 here would have made this
          header fight them for the same viewport position.
          Sticky Header Overlap fix, round 2 (2026-09-28) — this header
          previously never actually stuck: the outer div above was
          `overflow-x-hidden`, which (per the CSS overflow spec) forces
          `overflow-y: auto` too, turning it into an accidental scroll
          container that neutralizes `position: sticky` for this header.
          Moved `overflow-x-hidden` down to <main> below (where the wide
          tables it exists for actually are) and switched the offset from
          a Tailwind utility class to a plain CSS custom property consumed
          via inline style — see app/globals.css's own comment. */}
      <header
        className="border-b border-slate-800/80 bg-[#070c18]/90 backdrop-blur-2xl sticky z-40"
        style={{ top: "var(--admin-content-offset)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-16 py-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 rounded-lg transition-all shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t("common.adminConsole")}
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-emerald-400 shrink-0" />
                {t("generator.title")}
              </h1>
              <p className="text-[11px] text-slate-400 font-mono">
                {t("generator.subtitle")}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6 overflow-x-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Batch picker */}
          <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col min-h-[420px]">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                {t("ui.gen.selectBatches")}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold"
                >
                  {t("ui.common.selectAll")}
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold"
                >
                  {t("ui.common.clear")}
                </button>
              </div>
            </div>

            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={t("ui.common.searchBatchIdGradePolymerOr")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-800 rounded-xl divide-y divide-slate-800/60 min-h-[240px] max-h-[480px]">
              {loading ? (
                <div className="p-6 text-center text-xs text-slate-500 font-mono">{t("ui.gen.loadingPassports")}</div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 font-mono">
                  {passports.length === 0 ? t("ui.gen.noPassportsIssuedYet") : t("ui.common.noBatchesMatchYourSearch")}
                </div>
              ) : (
                filtered.map((p) => {
                  const isSelected = selected.has(p.id);
                  const isFocused = focusedId === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 transition cursor-pointer ${
                        isFocused ? "bg-emerald-500/10" : isSelected ? "bg-slate-800/40" : "hover:bg-slate-800/40"
                      }`}
                      onClick={() => focusRow(p)}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRow(p.id);
                        }}
                        aria-label={isSelected ? t("ui.gen.deselectBatch") : t("ui.gen.selectBatch")}
                        className="shrink-0"
                        disabled={!p.qrCodePayloadUrl}
                        title={!p.qrCodePayloadUrl ? t("ui.gen.noQrLinkRecordedCanT") : undefined}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Square className={`w-4 h-4 ${p.qrCodePayloadUrl ? "text-slate-600" : "text-slate-800"}`} />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-mono font-bold text-emerald-400 truncate">{p.batchId}</div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {p.polymerType} · {p.grade}
                          {!p.qrCodePayloadUrl && <span className="text-amber-400 ml-1.5">{t("ui.gen.noQr")}</span>}
                        </div>
                      </div>
                      <a
                        href={`/api/passports/${encodeURIComponent(p.batchId)}/certificate.pdf`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title={t("ui.gen.downloadCertificatePdfForThisBatch")}
                        className="shrink-0 inline-flex items-center gap-1 text-[10px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded-lg transition-all"
                      >
                        <FileBadge className="w-3 h-3" />
                        <span className="hidden sm:inline">{t("ui.common.certificate")}</span>
                      </a>
                    </div>
                  );
                })
              )}
            </div>

            <p className="text-[10px] text-slate-500 font-mono mt-2">
              {selected.size} {t("ui.gen.selected")}{selectedEligible.length} {t("ui.gen.eligibleForLabelSheet")}
              {selectedMissingQr > 0 ? t("ui.gen.missingAQrLink", { v0: selectedMissingQr }) : ""}) · {MAX_LABELS_PER_SHEET} {t("ui.gen.maxPerSheet")}
            </p>
          </div>

          {/* Live preview + export controls */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-slate-100 mb-3">{t("generator.section.livePreview")}</h2>
              {focusedPassport ? (
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white rounded-xl w-fit shrink-0">
                    {focusedPassport.qrCodePayloadUrl ? (
                      <QRCodeSVG
                        value={focusedPassport.qrCodePayloadUrl}
                        size={layout === "large" ? 140 : 96}
                        bgColor="#FFFFFF"
                        fgColor="#0f172a"
                        level="M"
                      />
                    ) : (
                      <div
                        style={{ width: layout === "large" ? 140 : 96, height: layout === "large" ? 140 : 96 }}
                        className="flex items-center justify-center text-slate-400 text-[9px] font-mono text-center px-2"
                      >
                        {t("ui.common.noQrLinkRecorded")}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div
                      className={`font-bold text-white truncate ${layout === "large" ? "text-lg" : "text-sm"}`}
                    >
                      {focusedPassport.batchId}
                    </div>
                    <div className={`text-slate-400 truncate ${layout === "large" ? "text-xs" : "text-[11px]"}`}>
                      {focusedPassport.polymerType} · {focusedPassport.grade}
                    </div>
                    <div className="text-slate-500 text-[10px] font-mono mt-0.5">GTIN {focusedPassport.gtin}</div>
                    <div className="text-slate-600 text-[9px] font-mono mt-1.5">{t("ui.gen.scanToVerifyPolymerDpp")}</div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 font-mono py-6 text-center">
                  {t("ui.gen.clickABatchOnTheLeft")}
                </p>
              )}
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-100">{t("generator.section.labelSheetSettings")}</h2>

              <div className="space-y-2">
                <span className="text-[11px] text-slate-400 font-mono block">{t("ui.gen.layout")}</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {LAYOUT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLayout(opt.value)}
                      className={`text-left rounded-xl border p-3 transition ${
                        layout === opt.value
                          ? "border-emerald-500/60 bg-emerald-500/10"
                          : "border-slate-800 bg-slate-950 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white mb-1">
                        {opt.value === "large" ? (
                          <Rows3 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <SquareIcon className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                        {t(opt.label)}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">{t(opt.description)}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 font-mono block mb-1">
                  {t("ui.gen.copiesPerBatch")} {copiesPerBatch}
                </span>
                <input
                  type="range"
                  min={1}
                  max={MAX_COPIES_PER_BATCH}
                  value={copiesPerBatch}
                  onChange={(e) => setCopiesPerBatch(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] flex justify-between">
                <span className="text-slate-500">{t("ui.gen.estimatedOutput")}</span>
                <span className="text-emerald-400 font-bold">
                  {totalLabels} {t(totalLabels === 1 ? "ui.gen.label" : "ui.gen.labels")} · {estimatedPages}{" "}
                  {t(estimatedPages === 1 ? "ui.gen.page" : "ui.gen.pages")}
                </span>
              </div>

              {sheetError && (
                <div className="flex items-start gap-1.5 text-[11px] text-red-400 font-mono bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{sheetError}</span>
                </div>
              )}

              <button
                onClick={handleDownloadLabelSheet}
                disabled={selectedEligible.length === 0 || preparingSheet}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl transition text-xs"
              >
                {preparingSheet ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                {preparingSheet ? t("common.preparing") : `${t("generator.button.downloadLabelSheet")} (${selectedEligible.length})`}
              </button>

              {focusedPassport && (
                <a
                  href={`/api/passports/${encodeURIComponent(focusedPassport.batchId)}/certificate.pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  {t("generator.button.downloadCertPdf")} ({focusedPassport.batchId})
                </a>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
