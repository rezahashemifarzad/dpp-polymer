/**
 * components/landing/contact-section.tsx
 * -----------------------------------------------------------------------
 * Contact section (#contact): the official mailbox for all inquiries,
 * shown as a visible, selectable address plus a mail button. The address
 * comes from lib/site-config.ts (CONTACT_EMAIL), the same source the
 * footer, pilot request, Imprint and privacy page use.
 */

import { Mail } from "lucide-react";
import { CtaLink } from "./cta-link";
import { SectionHeading } from "./section-heading";
import { CONTACT_EMAIL, contactMailto, type SiteLocale } from "@/lib/site-config";
import { LANDING_COPY } from "@/lib/i18n/landing-dictionary";

interface ContactSectionProps {
  locale: SiteLocale;
}

export function ContactSection({ locale }: ContactSectionProps) {
  const copy = LANDING_COPY[locale].contact;
  return (
    <section
      aria-labelledby="contact-title"
      id="contact"
      className="scroll-mt-16 border-t border-slate-200 bg-slate-50 py-24 sm:py-28"
    >
      <div className="mx-auto grid max-w-6xl gap-12 px-5 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:px-8">
        <SectionHeading id="contact-title" eyebrow={copy.eyebrow} title={copy.title} lead={copy.lead} />
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_1px_2px_rgba(6,17,31,0.04)] sm:p-9">
          <p className="flex items-center gap-2.5 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            <Mail className="h-4 w-4 text-teal-700" aria-hidden="true" />
            {copy.emailLabel}
          </p>
          <p className="mt-3">
            <a
              href={contactMailto()}
              className="break-all rounded-sm text-[1.375rem] font-semibold tracking-[-0.01em] text-navy-900 underline decoration-slate-300 underline-offset-4 transition-colors duration-150 hover:decoration-navy-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-navy-700 sm:text-2xl"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
          <div className="mt-7">
            <CtaLink href={contactMailto()} variant="solid-dark" size="lg" arrow>
              {copy.cta}
            </CtaLink>
          </div>
        </div>
      </div>
    </section>
  );
}
