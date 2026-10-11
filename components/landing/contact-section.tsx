/**
 * components/landing/contact-section.tsx
 * -----------------------------------------------------------------------
 * Contact section (#contact): a short invitation with one primary button
 * that opens the inquiry dialog (contact-dialog.tsx → contact-form.tsx →
 * lib/actions/submit-inquiry.ts, which emails the official mailbox). The
 * address itself stays visible as a mail link for visitors who prefer
 * their own mail program; it comes from lib/site-config.ts
 * (CONTACT_EMAIL), the same source the footer, pilot request, Imprint and
 * privacy page use.
 */

import { ArrowRight, Mail } from "lucide-react";
import { ContactDialog } from "./contact-dialog";
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
      <div className="mx-auto grid max-w-6xl gap-12 px-5 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-16 lg:px-8">
        <SectionHeading id="contact-title" eyebrow={copy.eyebrow} title={copy.title} lead={copy.lead} />
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_1px_2px_rgba(6,17,31,0.04)] sm:p-9">
          {/* Opened by contact-dialog.tsx via the data-contact-trigger attribute. */}
          <button
            type="button"
            data-contact-trigger=""
            aria-haspopup="dialog"
            className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-navy-900 px-6 text-[15px] font-semibold text-white shadow-[0_1px_2px_rgba(6,17,31,0.25)] transition-[background-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-px hover:bg-navy-800 hover:shadow-[0_8px_24px_-8px_rgba(6,17,31,0.55)] active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:w-auto"
          >
            {copy.cta}
            <ArrowRight
              className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </button>
          <p className="mt-8 flex items-center gap-2.5 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            <Mail className="h-4 w-4 text-teal-700" aria-hidden="true" />
            {copy.emailLabel}
          </p>
          <p className="mt-2">
            <a
              href={contactMailto()}
              className="break-all rounded-sm text-[17px] font-semibold text-navy-900 underline decoration-slate-300 underline-offset-4 transition-colors duration-150 hover:decoration-navy-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-navy-700"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </div>
      <ContactDialog locale={locale} copy={copy} />
    </section>
  );
}
