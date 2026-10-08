/**
 * components/landing/passport-preview.tsx
 * -----------------------------------------------------------------------
 * Static, clearly labelled sample of what a batch passport carries. Values
 * are illustrative; the GTIN is GS1's own published example number
 * (09506000134352), so it can never collide with a real product.
 */

import { Check, QrCode } from "lucide-react";

const PROPERTIES = [
  { label: "Melt flow index", detail: "ISO 1133 · 230 °C / 2.16 kg", value: "12.0", unit: "g/10 min" },
  { label: "Density", detail: "ISO 1183", value: "0.905", unit: "g/cm³" },
  { label: "Carbon footprint", detail: "Cradle-to-gate, PEF", value: "1.42", unit: "kg CO₂e/kg" },
] as const;

const CHECKS = [
  "REACH: no SVHC above 0.1 % w/w",
  "ISCC PLUS mass balance — auditor verified",
  "PPWR recycled-content declaration filed",
] as const;

export function PassportPreview() {
  return (
    <figure className="w-full max-w-md rounded-xl border border-white/10 bg-white text-navy-900 shadow-2xl shadow-black/40">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Digital Product Passport</p>
          <p className="mt-1 text-base font-semibold">rPP compound · Batch RP-2026-0418</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800 ring-1 ring-teal-200">
          <Check className="h-3 w-3" aria-hidden="true" />
          Issued
        </span>
      </div>

      <div className="px-5 py-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium text-slate-600">Post-consumer recycled content</span>
          <span className="font-semibold tabular-nums">35 %</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-slate-100" aria-hidden="true">
          <div className="h-1.5 w-[35%] rounded-full bg-teal-600" />
        </div>

        <dl className="mt-5 divide-y divide-slate-100">
          {PROPERTIES.map((p) => (
            <div key={p.label} className="flex items-baseline justify-between gap-4 py-2.5">
              <dt>
                <span className="block text-sm font-medium text-slate-700">{p.label}</span>
                <span className="block text-xs text-slate-500">{p.detail}</span>
              </dt>
              <dd className="shrink-0 text-right font-mono text-sm tabular-nums text-navy-900">
                {p.value} <span className="text-xs text-slate-500">{p.unit}</span>
              </dd>
            </div>
          ))}
        </dl>

        <ul className="mt-4 space-y-2">
          {CHECKS.map((c) => (
            <li key={c} className="flex items-start gap-2 text-[13px] text-slate-700">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-700" aria-hidden="true" />
              {c}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-3 rounded-b-xl border-t border-slate-200 bg-slate-50 px-5 py-3">
        <QrCode className="h-8 w-8 shrink-0 text-navy-800" aria-hidden="true" />
        <div className="min-w-0 font-mono text-[11px] leading-relaxed text-slate-600">
          <p className="truncate">/01/09506000134352/21/RP-2026-0418</p>
          <p className="truncate">SHA-256 9f2c4be1…07d3e41a</p>
        </div>
      </div>
      <figcaption className="sr-only">Sample passport with illustrative values</figcaption>
    </figure>
  );
}
