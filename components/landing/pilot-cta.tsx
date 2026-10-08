/**
 * components/landing/pilot-cta.tsx
 * -----------------------------------------------------------------------
 * Closing call to action (#pilot): how a pilot runs, plus the two actions.
 */

import { CtaLink } from "./cta-link";
import { ROUTES, pilotMailto, type SiteLocale } from "@/lib/site-config";
import { LANDING_COPY } from "@/lib/i18n/landing-dictionary";

interface PilotCtaProps {
  locale: SiteLocale;
}

export function PilotCta({ locale }: PilotCtaProps) {
  const copy = LANDING_COPY[locale].pilot;
  return (
    <section aria-labelledby="pilot-title" id="pilot" className="scroll-mt-16 bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white px-7 py-12 sm:px-12 sm:py-16">
          <div className="grid gap-14 lg:grid-cols-[1fr_1.05fr] lg:items-center">
            <div>
              <h2
                id="pilot-title"
                className="text-[2rem] font-semibold leading-[1.15] tracking-[-0.022em] text-navy-900 text-balance sm:text-[2.5rem]"
              >
                {copy.title}
              </h2>
              <p className="mt-5 text-[17px] leading-[1.7] text-slate-600 text-pretty">{copy.lead}</p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <CtaLink href={pilotMailto(locale)} variant="solid-dark" size="lg" arrow>
                  {copy.requestPilot}
                </CtaLink>
                <CtaLink href={ROUTES.platform} variant="outline-dark" size="lg">
                  {copy.launchPlatform}
                </CtaLink>
              </div>
            </div>
            <ol className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(6,17,31,0.04)]">
              {copy.steps.map((step, i) => (
                <li key={step.title} className="flex gap-5 px-7 py-6">
                  <span className="pt-0.5 font-mono text-[13px] font-semibold text-teal-700">0{i + 1}</span>
                  <div>
                    <p className="text-[15.5px] font-semibold text-navy-900">{step.title}</p>
                    <p className="mt-1.5 text-[14.5px] leading-[1.65] text-slate-600">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
