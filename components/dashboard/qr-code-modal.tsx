"use client";

/**
 * components/dashboard/qr-code-modal.tsx
 * -----------------------------------------------------------------------
 * Sprint 2.2 (Dynamic QR Code Engine & Factory Batch Labeling) — the
 * reusable single-batch QR preview + download component. Renders the
 * batch's already-persisted `qrCodePayloadUrl` (built by lib/qr.ts's
 * buildGs1VerificationUrl at passport creation — the real GS1 Digital
 * Link, e.g. /01/{GTIN}/21/{BATCH}) as a scannable QR code, and adds PNG
 * and SVG download — a real gap: app/page.tsx already had an ad-hoc
 * "Show QR & Twin" modal with a live QR preview, but no way to actually
 * get the image out of the browser, and app/admin/page.tsx (the *other*
 * independent Material Ledger UI — see
 * claude/circular-economy-platform-upgrade-notes.md's "IMPORTANT" note)
 * had no QR preview at all, only a bare "View ↗" link to the raw URL.
 * This one component now backs both.
 *
 * Deliberately takes a narrow, page-shape-agnostic prop set (batchId,
 * label, qrUrl) rather than the full ApiPassport / DisplayPassport type —
 * app/page.tsx and app/admin/page.tsx use two different passport shapes
 * (see the "two independent Material Ledger tables" note above), so this
 * component stays decoupled from either and each call site maps its own
 * data into these three fields.
 *
 * Download implementation: qrcode.react's <QRCodeSVG> renders a real
 * inline <svg> DOM node. SVG download serializes it directly; PNG download
 * draws that serialized SVG onto an off-screen <canvas> at a 6x upscale
 * (a 180px on-screen preview becomes a ~1080px PNG — comfortably
 * print-quality for a physical label) and exports the canvas. Both run
 * entirely client-side — no server round trip needed for a single label
 * (contrast with the bulk PDF sheet in qr-label-sheet-modal.tsx, which
 * does need the server to composite many labels onto print-accurate A4
 * pages).
 */

import { useRef } from "react";
import { X, Download, ExternalLink } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface QrCodeModalProps {
  open: boolean;
  onClose: () => void;
  batchId: string;
  label: string;
  qrUrl: string | null;
  // Optional extra record fields (record hash, recycled %, certification,
  // etc.) rendered as a label/value panel below the QR — the ad-hoc
  // "Show QR & Twin" modal this replaces in app/page.tsx showed a record
  // hash, PCR %, and certification alongside the QR, and that context is
  // still useful, so it's preserved here as an opt-in prop rather than
  // dropped. Omitted entirely (e.g. from app/admin/page.tsx, which never
  // had this panel) when not passed.
  details?: { label: string; value: string; title?: string }[];
}

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

export function QrCodeModal({ open, onClose, batchId, label, qrUrl, details }: QrCodeModalProps) {
  const qrBoxRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  function getSvgElement(): SVGSVGElement | null {
    return qrBoxRef.current?.querySelector("svg") ?? null;
  }

  function handleDownloadSvg() {
    const svg = getSvgElement();
    if (!svg) return;
    const serialized = new XMLSerializer().serializeToString(svg);
    triggerBlobDownload(new Blob([serialized], { type: "image/svg+xml" }), `qr-${batchId}.svg`);
  }

  function handleDownloadPng() {
    const svg = getSvgElement();
    if (!svg) return;
    const serialized = new XMLSerializer().serializeToString(svg);
    const svgUrl = URL.createObjectURL(new Blob([serialized], { type: "image/svg+xml;charset=utf-8" }));

    const img = new Image();
    img.onload = () => {
      const scale = 6;
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(svgUrl);
      if (!ctx) return;
      // White backing — the SVG itself has no background fill, and a QR
      // code on a transparent PNG can fail to scan when placed on a
      // non-white physical label.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) triggerBlobDownload(blob, `qr-${batchId}.png`);
      }, "image/png");
    };
    img.src = svgUrl;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-6 relative shadow-2xl my-8">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1.5 rounded-xl bg-slate-800"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-5">
          <div ref={qrBoxRef} className="p-4 bg-white rounded-2xl w-fit mx-auto mb-3 shadow-xl">
            {qrUrl ? (
              <QRCodeSVG value={qrUrl} size={180} bgColor="#FFFFFF" fgColor="#0f172a" level="M" />
            ) : (
              <div className="w-[180px] h-[180px] flex items-center justify-center text-slate-400 text-[10px] font-mono text-center px-4">
                No QR link recorded for this batch yet
              </div>
            )}
          </div>
          <h4 className="font-bold text-base text-white break-words">{label}</h4>
          <p className="text-xs text-slate-400 font-mono mt-0.5">{batchId}</p>
        </div>

        {qrUrl && (
          <p className="text-[10px] text-slate-500 font-mono text-center mb-5 break-all px-2 leading-relaxed">
            {qrUrl}
          </p>
        )}

        {details && details.length > 0 && (
          <div className="space-y-2.5 font-mono text-xs bg-slate-950 p-4 rounded-xl border border-slate-800 mb-5">
            {details.map((d, i) => (
              <div
                key={d.label}
                className={`flex justify-between gap-3 ${
                  i < details.length - 1 ? "border-b border-slate-800 pb-2" : ""
                }`}
              >
                <span className="text-slate-500 shrink-0">{d.label}</span>
                <span className="text-white font-bold text-[10px] truncate max-w-[180px]" title={d.title}>
                  {d.value}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            onClick={handleDownloadPng}
            disabled={!qrUrl}
            className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl transition text-xs"
          >
            <Download className="w-3.5 h-3.5" /> PNG
          </button>
          <button
            onClick={handleDownloadSvg}
            disabled={!qrUrl}
            className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 font-bold rounded-xl transition text-xs"
          >
            <Download className="w-3.5 h-3.5" /> SVG
          </button>
        </div>

        <a
          href={qrUrl || "#"}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!qrUrl}
          className={`flex items-center justify-center gap-1.5 w-full py-2.5 font-mono font-bold text-xs rounded-xl transition ${
            qrUrl
              ? "bg-slate-800 hover:bg-slate-700 text-slate-200"
              : "bg-slate-800/50 text-slate-600 cursor-not-allowed pointer-events-none"
          }`}
        >
          Open Public Verification Page <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
