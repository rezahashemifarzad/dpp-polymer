/**
 * components/landing/compliance-section.tsx
 * -----------------------------------------------------------------------
 * Regulations and standards the platform's data model is built around
 * (#compliance), with what DPP-Polymer records for each. Worded as
 * "supports": the economic operator stays responsible for its declarations.
 */

import { SectionHeading } from "./section-heading";
import type { SiteLocale } from "@/lib/site-config";
import { LANDING_COPY } from "@/lib/i18n/landing-dictionary";

interface ComplianceSectionProps {
  locale: SiteLocale;
}

export function ComplianceSection({ locale }: ComplianceSectionProps) {
  const copy = LANDING_COPY[locale].compliance;
  return (
    <section
      aria-labelledby="compliance-title"
      id="compliance"
      className="scroll-mt-16 border-y border-slate-200/80 bg-slate-50 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        <SectionHeading id="compliance-title" eyebrow={copy.eyebrow} title={copy.title} lead={copy.lead} />
        <div className="mt-16 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(6,17,31,0.04)]">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">{copy.caption}</caption>
            <thead className="hidden border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 md:table-header-group">
              <tr>
                <th scope="col" className="w-[24%] px-7 py-3.5">{copy.columns.framework}</th>
                <th scope="col" className="w-[24%] px-7 py-3.5">{copy.columns.reference}</th>
                <th scope="col" className="px-7 py-3.5">{copy.columns.coverage}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {copy.frameworks.map((f) => (
                <tr
                  key={f.name}
                  className="flex flex-col gap-1 px-6 py-5 transition-colors duration-150 hover:bg-slate-50/70 md:table-row md:p-0"
                >
                  <th scope="row" className="text-[15px] font-semibold text-navy-900 md:px-7 md:py-6 md:align-top">
                    {f.name}
                  </th>
                  <td className="font-mono text-[12.5px] text-slate-500 md:px-7 md:py-6 md:align-top md:leading-6">
                    {f.reference}
                  </td>
                  <td className="pt-1.5 text-[14.5px] leading-[1.65] text-slate-700 md:px-7 md:py-6 md:align-top">
                    {f.coverage}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-6 max-w-3xl text-[13px] leading-relaxed text-slate-500">{copy.disclaimer}</p>
      </div>
    </section>
  );
}
