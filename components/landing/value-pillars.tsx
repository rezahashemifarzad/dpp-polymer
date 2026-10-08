/**
 * components/landing/value-pillars.tsx
 * -----------------------------------------------------------------------
 * The three value pillars (#features): ESPR/PPWR compliance, role-based
 * access control, and supply-chain traceability. Each point maps to a
 * feature that exists in the platform today.
 */

import type { LucideIcon } from "lucide-react";
import { Network, Scale, ShieldCheck } from "lucide-react";
import { SectionHeading } from "./section-heading";
import type { SiteLocale } from "@/lib/site-config";
import { LANDING_COPY } from "@/lib/i18n/landing-dictionary";

/** Icons in the same order as LandingCopy["features"]["pillars"]. */
const ICONS: LucideIcon[] = [Scale, ShieldCheck, Network];

interface ValuePillarsProps {
  locale: SiteLocale;
}

export function ValuePillars({ locale }: ValuePillarsProps) {
  const copy = LANDING_COPY[locale].features;
  return (
    <section aria-labelledby="features-title" id="features" className="scroll-mt-16 bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        <SectionHeading id="features-title" eyebrow={copy.eyebrow} title={copy.title} lead={copy.lead} />
        <div className="mt-16 grid gap-5 md:grid-cols-3">
          {copy.pillars.map(({ title, summary, points }, i) => {
            const Icon = ICONS[i] ?? Scale;
            return (
              <article
                key={title}
                className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-8 transition-[border-color,box-shadow,transform] duration-300 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_40px_-20px_rgba(6,17,31,0.25)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 lg:p-9"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-900 text-teal-300 transition-colors duration-300 group-hover:bg-navy-800">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-7 text-[19px] font-semibold tracking-[-0.012em] text-navy-900">{title}</h3>
                <p className="mt-3 text-[15px] leading-[1.65] text-slate-600">{summary}</p>
                <ul className="mt-7 space-y-3.5 border-t border-slate-100 pt-7">
                  {points.map((point) => (
                    <li key={point} className="flex gap-3 text-[14px] leading-snug text-slate-700">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-teal-600" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
