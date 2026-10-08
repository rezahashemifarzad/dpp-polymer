/**
 * components/landing/landing-nav.tsx
 * -----------------------------------------------------------------------
 * Top bar of the public corporate site, per language. Server-rendered; the
 * only client code is the EN/DE switch. The mobile menu is a native
 * <details> disclosure. The platform's own internal nav
 * (components/SiteNav.tsx) is hidden on these pages and takes over once
 * the visitor enters /app.
 */

import Link from "next/link";
import { Menu } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { CtaLink } from "./cta-link";
import { LanguageToggle } from "./language-toggle";
import { LOCALE_ROUTES, ROUTES, sectionHref, type SiteLocale } from "@/lib/site-config";
import { LANDING_COPY } from "@/lib/i18n/landing-dictionary";

interface LandingNavProps {
  locale: SiteLocale;
  /** The equivalent of the current page in each language. */
  alternates: Record<SiteLocale, string>;
}

const NAV_LINK =
  "relative rounded-sm text-[13.5px] font-medium text-slate-300 transition-colors duration-150 hover:text-white " +
  "after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-white/50 " +
  "after:transition-transform after:duration-200 hover:after:scale-x-100 motion-reduce:after:transition-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white";

export function LandingNav({ locale, alternates }: LandingNavProps) {
  const copy = LANDING_COPY[locale];
  const sections = [
    { href: sectionHref(locale, "features"), label: copy.nav.features },
    { href: sectionHref(locale, "compliance"), label: copy.nav.compliance },
    { href: sectionHref(locale, "security"), label: copy.nav.security },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-navy-950 text-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:px-6 lg:px-8">
        <Link
          href={LOCALE_ROUTES[locale].home}
          aria-label={copy.a11y.home}
          className="rounded-sm transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <BrandMark />
        </Link>

        <nav aria-label={copy.a11y.mainNav} className="hidden items-center gap-9 md:flex">
          {sections.map((link) => (
            <Link key={link.href} href={link.href} className={NAV_LINK}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <LanguageToggle current={locale} hrefs={alternates} label={copy.a11y.languageSwitch} />
          <span className="h-5 w-px bg-white/10" aria-hidden="true" />
          <Link href={ROUTES.login} className={NAV_LINK}>
            {copy.nav.login}
          </Link>
          <CtaLink href={ROUTES.platform} variant="solid-light" size="sm" arrow>
            {copy.nav.launchApp}
          </CtaLink>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <LanguageToggle current={locale} hrefs={alternates} label={copy.a11y.languageSwitch} />
          <details className="group relative">
            <summary
              className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg text-slate-200 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white [&::-webkit-details-marker]:hidden"
              aria-label={copy.a11y.openMenu}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </summary>
            <div className="absolute right-0 top-12 w-64 rounded-xl border border-white/10 bg-navy-900 p-2 shadow-2xl shadow-black/40">
              <nav aria-label={copy.a11y.mainNav} className="flex flex-col">
                {[...sections, { href: ROUTES.login, label: copy.nav.login }].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-white/[0.06] hover:text-white"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-2 border-t border-white/10 pt-3">
                <CtaLink href={ROUTES.platform} variant="solid-light" className="w-full" arrow>
                  {copy.nav.launchApp}
                </CtaLink>
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
