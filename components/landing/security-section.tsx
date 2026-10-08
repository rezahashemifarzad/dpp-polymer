/**
 * components/landing/security-section.tsx
 * -----------------------------------------------------------------------
 * Security and data integrity (#security): the role model, plus the three
 * integrity guarantees the platform enforces in code.
 */

import type { LucideIcon } from "lucide-react";
import { Building2, Database, Eye, KeyRound, Lock, ScrollText, ShieldCheck, Truck } from "lucide-react";
import { SectionHeading } from "./section-heading";
import type { SiteLocale } from "@/lib/site-config";
import { LANDING_COPY } from "@/lib/i18n/landing-dictionary";

/** Icons in the same order as LandingCopy["security"]["roles"] / ["guarantees"]. */
const ROLE_ICONS: LucideIcon[] = [ShieldCheck, KeyRound, Building2, Truck, Eye];
const GUARANTEE_ICONS: LucideIcon[] = [Lock, ScrollText, Database];

interface SecuritySectionProps {
  locale: SiteLocale;
}

export function SecuritySection({ locale }: SecuritySectionProps) {
  const copy = LANDING_COPY[locale].security;
  return (
    <section aria-labelledby="security-title" id="security" className="scroll-mt-16 bg-navy-900 py-24 text-white sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        <SectionHeading id="security-title" tone="dark" eyebrow={copy.eyebrow} title={copy.title} lead={copy.lead} />

        <div className="mt-16 grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
          <div>
            <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-slate-400">{copy.rolesHeading}</h3>
            <ul className="mt-5 divide-y divide-white/[0.08] overflow-hidden rounded-2xl border border-white/[0.08] bg-navy-950/40">
              {copy.roles.map(({ name, access }, i) => {
                const Icon = ROLE_ICONS[i] ?? ShieldCheck;
                return (
                  <li
                    key={name}
                    className="flex items-start gap-4 px-6 py-4 transition-colors duration-150 hover:bg-white/[0.03]"
                  >
                    <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-teal-300" aria-hidden="true" />
                    <div>
                      <p className="text-[14.5px] font-semibold">{name}</p>
                      <p className="mt-0.5 text-[13.5px] leading-relaxed text-slate-400">{access}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-slate-400">{copy.integrityHeading}</h3>
            <div className="mt-5 space-y-9">
              {copy.guarantees.map(({ title, body }, i) => {
                const Icon = GUARANTEE_ICONS[i] ?? Lock;
                return (
                  <div key={title} className="flex gap-5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.04]">
                      <Icon className="h-5 w-5 text-white" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-[17px] font-semibold tracking-[-0.01em]">{title}</p>
                      <p className="mt-2 text-[15px] leading-[1.7] text-slate-300">{body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
