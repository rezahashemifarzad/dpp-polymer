/**
 * components/landing/landing-footer.tsx
 * -----------------------------------------------------------------------
 * Corporate footer: brand, link columns, legal links and copyright.
 */

import Link from "next/link";
import { BrandMark } from "./brand-mark";
import { LEGAL_ENTITY, ROUTES, SITE, pilotMailto } from "@/lib/site-config";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#compliance", label: "Compliance" },
      { href: "/#security", label: "Security" },
    ],
  },
  {
    title: "Platform",
    links: [
      { href: ROUTES.platform, label: "Launch App" },
      { href: ROUTES.login, label: "Log in" },
      { href: pilotMailto(), label: "Request Pilot" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: ROUTES.imprint, label: "Imprint" },
      { href: ROUTES.privacy, label: "Privacy Policy" },
    ],
  },
] as const;

const LINK_CLASS =
  "text-sm text-slate-400 transition-colors hover:text-white rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

export function LandingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-navy-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <BrandMark />
            <p className="mt-4 text-sm leading-relaxed text-slate-400">{SITE.tagline}.</p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
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
        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {LEGAL_ENTITY.companyName}. All rights reserved.
          </p>
          <p>Digital Product Passports for the EU polymer industry.</p>
        </div>
      </div>
    </footer>
  );
}
