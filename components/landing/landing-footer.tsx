/**
 * components/landing/landing-footer.tsx
 * -----------------------------------------------------------------------
 * Corporate footer: brand, link columns, legal links and copyright, per
 * language.
 */

import Link from "next/link";
import { BrandMark } from "./brand-mark";
import { CONTACT_EMAIL, LEGAL_ENTITY, LOCALE_ROUTES, ROUTES, pilotMailto, sectionHref, type SiteLocale } from "@/lib/site-config";
import { LANDING_COPY } from "@/lib/i18n/landing-dictionary";

const LINK_CLASS =
  "rounded-sm text-[13.5px] text-slate-400 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

interface LandingFooterProps {
  locale: SiteLocale;
}

export function LandingFooter({ locale }: LandingFooterProps) {
  const copy = LANDING_COPY[locale];
  const routes = LOCALE_ROUTES[locale];
  const columns = [
    {
      title: copy.footer.product,
      links: [
        { href: sectionHref(locale, "features"), label: copy.nav.features },
        { href: sectionHref(locale, "compliance"), label: copy.nav.compliance },
        { href: sectionHref(locale, "security"), label: copy.nav.security },
      ],
    },
    {
      title: copy.footer.platform,
      links: [
        { href: ROUTES.platform, label: copy.nav.launchApp },
        { href: ROUTES.login, label: copy.nav.login },
        { href: pilotMailto(locale), label: copy.hero.requestPilot },
      ],
    },
    {
      title: copy.footer.legal,
      links: [
        { href: routes.imprint, label: copy.footer.imprint },
        { href: routes.privacy, label: copy.footer.privacy },
      ],
    },
  ];
  const year = new Date().getFullYear();

  return (
    <footer className="bg-navy-950 text-white">
      <div className="mx-auto max-w-6xl px-5 pb-10 pt-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <Link
              href={routes.home}
              aria-label={copy.a11y.home}
              className="inline-block rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <BrandMark />
            </Link>
            <p className="mt-4 text-[13.5px] leading-relaxed text-slate-400">{copy.footer.tagline}</p>
            <p className="mt-4">
              <a href={`mailto:${CONTACT_EMAIL}`} className={LINK_CLASS}>
                {CONTACT_EMAIL}
              </a>
            </p>
          </div>
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{col.title}</p>
              <ul className="mt-5 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("/") ? (
                      <Link href={link.href} className={LINK_CLASS}>
                        {link.label}
                      </Link>
                    ) : (
                      <a href={link.href} className={LINK_CLASS}>
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-white/[0.08] pt-7 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {LEGAL_ENTITY.companyName}. {copy.footer.rights}
          </p>
          <p>{copy.footer.closing}</p>
        </div>
      </div>
    </footer>
  );
}
