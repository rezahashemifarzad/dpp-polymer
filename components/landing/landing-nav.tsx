/**
 * components/landing/landing-nav.tsx
 * -----------------------------------------------------------------------
 * Top bar of the public corporate site. Server-rendered with no client
 * JavaScript: the mobile menu is a native <details> disclosure. The
 * platform's own internal nav (components/SiteNav.tsx) is hidden on these
 * pages and takes over once the visitor enters /app.
 */

import Link from "next/link";
import { Menu } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { CtaLink } from "./cta-link";
import { ROUTES } from "@/lib/site-config";

const SECTION_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#compliance", label: "Compliance" },
  { href: "/#security", label: "Security" },
] as const;

export function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-navy-950/95 text-white backdrop-blur supports-[backdrop-filter]:bg-navy-950/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="DPP-Polymer home"
          className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <BrandMark />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {SECTION_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white rounded-sm"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href={ROUTES.login}
            className="rounded-sm px-2 text-sm font-medium text-slate-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Log in
          </Link>
          <CtaLink href={ROUTES.platform}>Launch App</CtaLink>
        </div>

        <details className="group relative md:hidden">
          <summary
            className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-md text-slate-200 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white [&::-webkit-details-marker]:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </summary>
          <div className="absolute right-0 top-12 w-64 rounded-lg border border-white/10 bg-navy-900 p-2 shadow-2xl shadow-black/40">
            <nav aria-label="Mobile" className="flex flex-col">
              {SECTION_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/5"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href={ROUTES.login}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/5"
              >
                Log in
              </Link>
            </nav>
            <div className="mt-2 border-t border-white/10 pt-3">
              <CtaLink href={ROUTES.platform} className="w-full">
                Launch App
              </CtaLink>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
