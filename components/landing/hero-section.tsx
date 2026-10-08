/**
 * components/landing/hero-section.tsx
 * -----------------------------------------------------------------------
 * Navy hero: headline, sub-headline, the two primary actions (Request
 * Pilot, Launch Platform), a sample passport, and the trust band.
 */

import { CtaLink } from "./cta-link";
import { PassportPreview } from "./passport-preview";
import { TrustBand } from "./trust-band";
import { ROUTES, pilotMailto, type SiteLocale } from "@/lib/site-config";
import { LANDING_COPY } from "@/lib/i18n/landing-dictionary";

interface HeroSectionProps {
  locale: SiteLocale;
}

export function HeroSection({ locale }: HeroSectionProps) {
  const copy = LANDING_COPY[locale];
  return (
    <section className="relative isolate overflow-hidden bg-navy-950 text-white">
      {/* Fine engineering grid, fading out toward the bottom, and one soft
          navy light source top-right. Decorative only. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-40 -z-10 h-[36rem] w-[36rem] rounded-full bg-navy-700/40 blur-3xl"
      />

      <div className="mx-auto grid max-w-6xl items-center gap-16 px-5 pb-20 pt-16 sm:px-6 md:pt-24 lg:grid-cols-[1.12fr_0.88fr] lg:px-8 lg:pb-24 lg:pt-28">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400" aria-hidden="true" />
            {copy.hero.eyebrow}
          </p>
          <h1 className="mt-7 text-[2.5rem] font-semibold leading-[1.06] tracking-[-0.028em] text-balance sm:text-5xl lg:text-[3.5rem]">
            {copy.hero.title}
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-[1.7] text-slate-300 text-pretty">{copy.hero.lead}</p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <CtaLink href={pilotMailto(locale)} variant="solid-light" size="lg" arrow>
              {copy.hero.requestPilot}
            </CtaLink>
            <CtaLink href={ROUTES.platform} variant="outline-light" size="lg">
              {copy.hero.launchPlatform}
            </CtaLink>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <PassportPreview copy={copy.passport} />
        </div>
      </div>

      <TrustBand copy={copy.trust} />
    </section>
  );
}
