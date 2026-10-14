/**
 * components/landing/compliance-section.tsx
 * -----------------------------------------------------------------------
 * Regulations and standards the platform's data model is built around
 * (#compliance). Instead of bare acronyms, every framework shows its
 * acronym badge, full official name, legal reference, current status, a
 * plain-language "What it is", and a teal "How DPP-Polymer supports it"
 * box — so buyers and auditors who don't know every acronym can follow.
 *
 * Content: lib/i18n/compliance-frameworks.ts (EN/DE/FR, type-checked so the
 * build fails if a language or framework drifts). Section heading, caption
 * and disclaimer: lib/i18n/landing-dictionary.ts.
 *
 * Layout: one card per topic (Product passport, Packaging, Substances,
 * Traceability, Claims). Inside a card each framework is a row with two
 * columns from `lg` up (identity left, meaning + support right); below
 * `lg` the columns stack.
 *
 * Accessibility: heading levels h2 (section) → h3 (topic card) → h4
 * (framework); labelled regions per card; reference and status carry
 * screen-reader labels; decorative icons are aria-hidden.
 */

import { Check } from "lucide-react";
import { SectionHeading } from "./section-heading";
import type { SiteLocale } from "@/lib/site-config";
import { LANDING_COPY } from "@/lib/i18n/landing-dictionary";
import {
  COMPLIANCE_GROUP_ORDER,
  complianceFrameworks,
  frameworksInGroup,
} from "@/lib/i18n/compliance-frameworks";

interface ComplianceSectionProps {
  locale: SiteLocale;
}

export function ComplianceSection({ locale }: ComplianceSectionProps) {
  const copy = LANDING_COPY[locale].compliance;
  const content = complianceFrameworks[locale];

  return (
    <section
      aria-labelledby="compliance-title"
      id="compliance"
      className="scroll-mt-16 border-y border-slate-200/80 bg-slate-50 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        <SectionHeading id="compliance-title" eyebrow={copy.eyebrow} title={copy.title} lead={copy.lead} />

        <div role="group" aria-label={copy.caption} className="mt-16 space-y-8">
          {COMPLIANCE_GROUP_ORDER.map((groupId) => {
            const ids = frameworksInGroup(groupId);
            if (ids.length === 0) return null;
            const headingId = `compliance-group-${groupId}`;
            return (
              <section
                key={groupId}
                aria-labelledby={headingId}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(6,17,31,0.04)]"
              >
                <h3
                  id={headingId}
                  className="flex items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/70 px-6 py-3.5 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-slate-600 sm:px-8"
                >
                  {content.groups[groupId]}
                  <span className="font-mono text-[11px] font-medium tracking-normal text-slate-400" aria-hidden="true">
                    {ids.length}
                  </span>
                </h3>

                <ul className="divide-y divide-slate-100">
                  {ids.map((id) => {
                    const f = content.frameworks[id];
                    return (
                      <li
                        key={id}
                        className="grid gap-6 px-6 py-7 transition-colors duration-150 hover:bg-slate-50/60 motion-reduce:transition-none sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)] lg:gap-10"
                      >
                        {/* Identity: acronym, full name, legal reference, status */}
                        <div>
                          <span className="inline-flex items-center rounded-md bg-navy-900 px-2.5 py-1 font-mono text-[12px] font-semibold tracking-wide text-white">
                            {f.acronym}
                          </span>
                          <h4 className="mt-3 text-[16px] font-semibold leading-snug tracking-[-0.01em] text-navy-900 text-balance">
                            {f.fullName}
                          </h4>
                          <dl className="mt-3 space-y-1.5 text-[12.5px]">
                            <div>
                              <dt className="sr-only">{content.labels.reference}</dt>
                              <dd className="font-mono text-slate-500">{f.reference}</dd>
                            </div>
                            <div>
                              <dt className="sr-only">{content.labels.status}</dt>
                              <dd className="flex items-start gap-2 leading-snug text-slate-600">
                                <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" aria-hidden="true" />
                                {f.status}
                              </dd>
                            </div>
                          </dl>
                        </div>

                        {/* Meaning and platform support */}
                        <dl className="space-y-4">
                          <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              {content.labels.whatItIs}
                            </dt>
                            <dd className="mt-1.5 text-[14.5px] leading-[1.65] text-slate-700 text-pretty">{f.whatItIs}</dd>
                          </div>
                          <div className="rounded-xl border border-teal-100 bg-teal-50/50 px-4 py-3.5">
                            <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-800">
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                              {content.labels.howWeSupport}
                            </dt>
                            <dd className="mt-1.5 text-[14px] leading-[1.6] text-navy-900 text-pretty">{f.howWeSupport}</dd>
                          </div>
                        </dl>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <p className="mt-8 max-w-3xl text-[13px] leading-relaxed text-slate-500">{copy.disclaimer}</p>
      </div>
    </section>
  );
}
