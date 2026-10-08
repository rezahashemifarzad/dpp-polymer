/**
 * components/landing/hero-section.tsx
 * -----------------------------------------------------------------------
 * Navy hero: headline, sub-headline, the two primary actions (Request
 * Pilot, Launch Platform), three proof points, and a sample passport.
 */

import { ArrowRight } from "lucide-react";
import { CtaLink } from "./cta-link";
import { PassportPreview } from "./passport-preview";
import { ROUTES, pilotMailto } from "@/lib/site-config";

const PROOF_POINTS = [
  "GS1 Digital Link QR per batch",
  "SHA-256 sealed records",
  "Data hosted in the EU (Frankfurt)",
] as const;

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-navy-950 text-white">
      {/* Fine engineering grid, fading out toward the bottom. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-16 sm:px-6 md:pt-24 lg:grid-cols-[1.1fr_0.9fr] lg:pb-28">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400" aria-hidden="true" />
            Built for EU ESPR &amp; PPWR
          </p>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight text-balance sm:text-5xl">
            Verifiable product passports for polymers and recyclates.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
            DPP-Polymer turns batch data from compounders and recyclers into audit-ready Digital Product
            Passports: material properties, recycled content, carbon footprint and chain of custody, published
            through a standard GS1 QR code.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <CtaLink href={pilotMailto()} size="lg">
              Request Pilot
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </CtaLink>
            <CtaLink href={ROUTES.platform} variant="ghost-dark" size="lg">
              Launch Platform
            </CtaLink>
          </div>
          <ul className="mt-10 flex flex-col gap-x-6 gap-y-2 text-sm text-slate-400 sm:flex-row sm:flex-wrap">
            {PROOF_POINTS.map((p) => (
              <li key={p} className="flex items-center gap-2">
                <span className="h-px w-3 bg-slate-500" aria-hidden="true" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-center lg:justify-end">
          <PassportPreview />
        </div>
      </div>
    </section>
  );
}
