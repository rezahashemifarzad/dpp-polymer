/**
 * components/landing/pilot-cta.tsx
 * -----------------------------------------------------------------------
 * Closing call to action (#pilot): how a pilot runs, plus the two actions.
 */

import { ArrowRight } from "lucide-react";
import { CtaLink } from "./cta-link";
import { ROUTES, pilotMailto } from "@/lib/site-config";

const STEPS = [
  { title: "Scope", body: "Pick one product line and the passport fields your customers ask for." },
  { title: "Onboard", body: "Import batch data from your ERP or invite suppliers to submit it." },
  { title: "Issue", body: "Publish passports, print GS1 QR labels and share access with auditors and buyers." },
] as const;

export function PilotCta() {
  return (
    <section aria-labelledby="pilot-title" id="pilot" className="scroll-mt-16 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-12 sm:px-12 sm:py-14">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <h2 id="pilot-title" className="text-3xl font-semibold tracking-tight text-navy-900 text-balance sm:text-4xl">
                Start with a pilot on your next production batch.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-600">
                We work with polymer compounders and recyclers to issue their first passports on real material, so the
                data is in place before customers and regulators ask for it.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <CtaLink href={pilotMailto()} variant="inverse" size="lg">
                  Request Pilot
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </CtaLink>
                <CtaLink href={ROUTES.platform} variant="secondary" size="lg">
                  Launch Platform
                </CtaLink>
              </div>
            </div>
            <ol className="space-y-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-5 bg-white px-6 py-5">
                  <span className="font-mono text-sm font-semibold text-teal-700">0{i + 1}</span>
                  <div>
                    <p className="font-semibold text-navy-900">{step.title}</p>
                    <p className="mt-1 text-[15px] leading-relaxed text-slate-600">{step.body}</p>
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
