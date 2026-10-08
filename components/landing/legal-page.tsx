/**
 * components/landing/legal-page.tsx
 * -----------------------------------------------------------------------
 * Shared shell for the corporate site's legal pages (Imprint/Impressum/
 * Mentions légales, Privacy/Datenschutz/Confidentialité): same nav and
 * footer as the landing page, readable single-column body, per language.
 */

import type { ReactNode } from "react";
import { LandingNav } from "./landing-nav";
import { LandingFooter } from "./landing-footer";
import { LOCALE_ROUTES, type SiteLocale } from "@/lib/site-config";
import { LANDING_COPY } from "@/lib/i18n/landing-dictionary";

interface LegalPageProps {
  locale: SiteLocale;
  page: "imprint" | "privacy";
  title: string;
  updated?: string;
  children: ReactNode;
}

export function LegalPage({ locale, page, title, updated, children }: LegalPageProps) {
  const copy = LANDING_COPY[locale];
  return (
    <div lang={locale} className="flex min-h-screen flex-col bg-white font-sans text-navy-900 antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-navy-900 focus:shadow-lg"
      >
        {copy.a11y.skipToContent}
      </a>
      <LandingNav locale={locale} alternates={{ en: LOCALE_ROUTES.en[page], de: LOCALE_ROUTES.de[page], fr: LOCALE_ROUTES.fr[page] }} />
      <main id="main" className="flex-1">
        <article className="mx-auto max-w-3xl px-5 py-20 sm:px-6 sm:py-24">
          <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.022em] sm:text-[2.5rem]">{title}</h1>
          {updated && <p className="mt-3 text-sm text-slate-500">{updated}</p>}
          <div className="mt-12 space-y-11 text-[15px] leading-[1.75] text-slate-700 [&_a]:font-medium [&_a]:text-teal-800 [&_a]:underline [&_a]:decoration-teal-800/30 [&_a]:underline-offset-2 [&_a:hover]:decoration-teal-800 [&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-navy-900 [&_h2+*]:mt-3 [&_p+p]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
            {children}
          </div>
        </article>
      </main>
      <LandingFooter locale={locale} />
    </div>
  );
}
