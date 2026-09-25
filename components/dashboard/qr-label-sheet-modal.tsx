"use client";

/**
 * components/dashboard/qr-label-sheet-modal.tsx
 * -----------------------------------------------------------------------
 * Sprint 2.2 (Dynamic QR Code Engine & Factory Batch Labeling) — the
 * "Factory Batch Labeling UI": a searchable multi-select over the current
 * Material Ledger, downloading a print-ready A4 PDF sheet of QR labels for
 * whichever batches are selected (GET /api/passports/label-sheet.pdf, see
 * lib/services/generate-qr-label-sheet-pdf.tsx). This is genuinely new —
 * neither Material Ledger UI (app/page.tsx's "ledger" tab or
 * app/admin/page.tsx) had any bulk/print-sheet capability before; the only
 * prior QR affordance was a single ad-hoc preview modal with no download.
 *
 * Same page-shape-agnostic prop pattern as qr-code-modal.tsx: takes a
 * normalized `QrLabelCandidate[]` rather than either page's own
 * ApiPassport/DisplayPassport type, so both Material Ledger UIs can feed
 * it their own data without this component caring which one it's in.
 *
 * The download itself uses fetch+blob (not a bare <a href> click) so a
 * failure — an over-cap selection, or a batch with no recorded QR link —
 * surfaces as an actual error message instead of silently opening the
 * route's JSON error body as if it were the PDF. `preparing` tracks the
 * in-flight request so the button shows a spinner and can't be
 * double-submitted while a (potentially large, many-QR-image) sheet is
 * still rendering server-side.
 */

import { useMemo, useState } from "react";
import { X, Search, Printer, CheckSquare, Square, Loader2, Download, AlertTriangle } from "lucide-react";

export interface QrLabelCandidate {
  id: string;
  batchId: string;
  label: string;
  polymerType: string;
  gtin: string;
  qrUrl: string | null;
}

interface QrLabelSheetModalProps {
  open: boolean;
  onClose: () => void;
  passports: QrLabelCandidate[];
}

const MAX_LABELS_PER_SHEET = 200;

export function QrLabelSheetModal({ open, onClose, passports }: QrLabelSheetModalProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preparing, setPreparing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Only batches with a recorded QR link can go on a label sheet at all —
  // matches the server route's own "none had a QR link" 404 case, but
  // filtered here too so the picker never lets someone select an
  // impossible batch in the first place.
  const eligible = useMemo(() => passports.filter((p) => !!p.qrUrl), [passports]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter(
      (p) =>
        p.batchId.toLowerCase().includes(q) ||
        p.label.toLowerCase().includes(q) ||
        p.gtin.toLowerCase().includes(q) ||
        p.polymerType.toLowerCase().includes(q)
    );
  }, [eligible, search]);

  if (!open) return null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelected(new Set(filtered.slice(0, MAX_LABELS_PER_SHEET).map((p) => p.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function handleDownload() {
    const batchIds = passports.filter((p) => selected.has(p.id)).map((p) => p.batchId);
    if (batchIds.length === 0) return;
    setErrorMsg(null);
    setPreparing(true);
    try {
      // fetch+blob rather than a bare <a href> click — unlike the existing
      // certificate.pdf export (always exactly one known-good batch), this
      // request can genuinely fail (0 of N selected batches still have a
      // recorded QR link, or the 200-label cap is exceeded), and a plain
      // link click would just silently open the JSON error body as if it
      // were the PDF instead of surfacing it as an error.
      const res = await fetch(
        `/api/passports/label-sheet.pdf?batchIds=${encodeURIComponent(batchIds.join(","))}`
      );
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `Request failed with status ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dpp-batch-labels-${batchIds.length}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to generate label sheet");
    } finally {
      setPreparing(false);
    }
  }

  return (
    // This modal already followed the "capped-height card + internal
    // overflow-y-auto region" pattern (see the batch list div below) —
    // the only change here is dropping the backdrop's own overflow-y-auto,
    // which was redundant with (and, on short viewports, could compete
    // with) the card's own max-h-[85vh]/flex-1 scroll region. Same fix
    // applied to batch-details-modal.tsx and create-passport-modal.tsx —
    // see those files' own comments.
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl p-6 relative shadow-2xl my-8 flex flex-col max-h-[85vh]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1.5 rounded-xl bg-slate-800"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-4 pr-8">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>Factory Batch Labels</span>
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Select batches below to generate a print-ready A4 QR label sheet ({MAX_LABELS_PER_SHEET} max per sheet).
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search batch ID, grade, polymer, or GTIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={selectAllFiltered}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold whitespace-nowrap"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold whitespace-nowrap"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto border border-slate-800 rounded-xl divide-y divide-slate-800/60 mb-4 min-h-[160px]">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 font-mono">
              {eligible.length === 0
                ? "No batches with a recorded QR link yet."
                : "No batches match your search."}
            </div>
          ) : (
            filtered.map((p) => {
              const isSelected = selected.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition ${
                    isSelected ? "bg-emerald-500/10" : "hover:bg-slate-800/40"
                  }`}
                >
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-600 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-mono font-bold text-emerald-400 truncate">{p.batchId}</div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {p.polymerType} · {p.label}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-600 font-mono shrink-0 hidden sm:block">{p.gtin}</div>
                </button>
              );
            })
          )}
        </div>

        {errorMsg && (
          <div className="mb-3 flex items-start gap-1.5 text-[11px] text-red-400 font-mono bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="text-xs text-slate-400 font-mono">{selected.size} selected</span>
          <button
            onClick={handleDownload}
            disabled={selected.size === 0 || preparing}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl transition text-xs whitespace-nowrap"
          >
            {preparing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {preparing ? "Preparing..." : `Download PDF Sheet (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
