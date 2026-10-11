/**
 * components/landing/landing-page.tsx
 * -----------------------------------------------------------------------
 * The full corporate landing page for one language. Rendered by
 * app/page.tsx (English, "/"), app/de/page.tsx (German, "/de") and
 * app/fr/page.tsx (French, "/fr").
 *
 * The root layout sets <html lang="en">; the German and French trees are
 * wrapped in lang="de" / lang="fr" so screen readers and hyphenation
 * use the right language rules.
 */

import type { Metadata } from "next";
import { LandingNav } from "./landing-nav";
import { HeroSection } from "./hero-section";
import { ValuePillars } from "./value-pillars";
import { ComplianceSection } from "./compliance-section";
import { SecuritySection } from "./security-section";
import { PilotCta } from "./pilot-cta";
import { ContactSection } from "./contact-section";
import { LandingFooter } from "./landing-footer";
import { LOCALE_ROUTES, SITE, siteUrl, type SiteLocale } from "@/lib/site-config";
import { LANDING_COPY } from "@/lib/i18n/landing-dictionary";

const OG_LOCALE: Record<SiteLocale, string> = { en: "en_GB", de: "de_DE", fr: "fr_FR" };

/** Metadata for a corporate-site page, with canonical URL and hreflang alternates. */
export function corporateMetadata(
  locale: SiteLocale,
  page: "home" | "imprint" | "privacy",
  title: string,
  description: string
): Metadata {
  return {
    metadataBase: siteUrl(),
    title,
    description,
    alternates: {
      canonical: LOCALE_ROUTES[locale][page],
      languages: {
        en: LOCALE_ROUTES.en[page],
        de: LOCALE_ROUTES.de[page],
        fr: LOCALE_ROUTES.fr[page],
        "x-default": LOCALE_ROUTES.en[page],
      },
    },
    openGraph: {
      title,
      description,
      type: "website",
      siteName: SITE.name,
      locale: OG_LOCALE[locale],
      url: LOCALE_ROUTES[locale][page],
    },
  };
}

export function landingMetadata(locale: SiteLocale): Metadata {
  const { title, description } = LANDING_COPY[locale].meta;
  return corporateMetadata(locale, "home", title, description);
}

interface LandingPageProps {
  locale: SiteLocale;
}

export function LandingPage({ locale }: LandingPageProps) {
  const copy = LANDING_COPY[locale];
  return (
    <div lang={locale} className="flex min-h-screen flex-col bg-white font-sans text-navy-900 antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-navy-900 focus:shadow-lg"
      >
        {copy.a11y.skipToContent}
      </a>
      <LandingNav locale={locale} alternates={{ en: LOCALE_ROUTES.en.home, de: LOCALE_ROUTES.de.home, fr: LOCALE_ROUTES.fr.home }} />
      <main id="main" className="flex-1">
        <HeroSection locale={locale} />
        <ValuePillars locale={locale} />
        <ComplianceSection locale={locale} />
        <SecuritySection locale={locale} />
        <PilotCta locale={locale} />
        <ContactSection locale={locale} />
      </main>
      <LandingFooter locale={locale} />
    </div>
  );
}
