/**
 * components/landing/passport-preview.tsx
 * -----------------------------------------------------------------------
 * Static, clearly labelled sample of what a batch passport carries. Values
 * are illustrative; the GTIN is GS1's own published example number
 * (09506000134352), so it can never collide with a real product.
 */

import { Check, QrCode } from "lucide-react";
import type { LandingCopy } from "@/lib/i18n/landing-dictionary";

interface PassportPreviewProps {
  copy: LandingCopy["passport"];
}

export function PassportPreview({ copy }: PassportPreviewProps) {
  return (
    <figure className="w-full max-w-[26rem]">
      <div className="rounded-2xl border border-white/10 bg-white text-navy-900 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] ring-1 ring-black/5 transition-transform duration-500 ease-out hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">{copy.kicker}</p>
            <p className="mt-1.5 text-[15px] font-semibold tracking-[-0.01em]">{copy.title}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800 ring-1 ring-teal-200/80">
            <Check className="h-3 w-3" aria-hidden="true" />
            {copy.status}
          </span>
        </div>

        <div className="px-6 py-5">
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="font-medium text-slate-600">{copy.pcr}</span>
            <span className="font-semibold tabular-nums">35 %</span>
          </div>
          <div className="mt-2.5 h-1.5 rounded-full bg-slate-100" aria-hidden="true">
            <div className="h-1.5 w-[35%] rounded-full bg-teal-600" />
          </div>

          <dl className="mt-5 divide-y divide-slate-100">
            {copy.properties.map((p) => (
              <div key={p.label} className="flex items-baseline justify-between gap-4 py-3">
                <dt>
                  <span className="block text-[13px] font-medium text-slate-700">{p.label}</span>
                  <span className="mt-0.5 block text-[11.5px] text-slate-500">{p.detail}</span>
                </dt>
                <dd className="shrink-0 text-right font-mono text-[13px] tabular-nums text-navy-900">
                  {p.value} <span className="text-[11px] text-slate-500">{p.unit}</span>
                </dd>
              </div>
            ))}
          </dl>

          <ul className="mt-4 space-y-2">
            {copy.checks.map((c) => (
              <li key={c} className="flex items-start gap-2 text-[12.5px] leading-snug text-slate-700">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-700" aria-hidden="true" />
                {c}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-3 rounded-b-2xl border-t border-slate-100 bg-slate-50/80 px-6 py-3.5">
          <QrCode className="h-8 w-8 shrink-0 text-navy-800" aria-hidden="true" />
          <div className="min-w-0 font-mono text-[11px] leading-relaxed text-slate-600">
            <p className="truncate">/01/09506000134352/21/RP-2026-0418</p>
            <p className="truncate">SHA-256 9f2c4be1…07d3e41a</p>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-[11.5px] text-slate-500">{copy.sampleNote}</figcaption>
    </figure>
  );
}
