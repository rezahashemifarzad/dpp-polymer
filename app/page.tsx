/**
 * app/page.tsx — Corporate landing page (public)
 * -----------------------------------------------------------------------
 * The root path is the public company website. The platform (Material
 * Ledger console) moved to /app (app/app/page.tsx); "Launch App" /
 * "Launch Platform" link there, and "Log in" goes to /login.
 *
 * Fully static: no session, no database access, so it is prerendered at
 * build time and served from Vercel's edge cache. components/SiteNav.tsx
 * (the platform's internal nav) does not render on this path.
 */

import type { Metadata } from "next";
import { LandingNav } from "@/components/landing/landing-nav";
import { HeroSection } from "@/components/landing/hero-section";
import { ValuePillars } from "@/components/landing/value-pillars";
import { ComplianceSection } from "@/components/landing/compliance-section";
import { SecuritySection } from "@/components/landing/security-section";
import { PilotCta } from "@/components/landing/pilot-cta";
import { LandingFooter } from "@/components/landing/landing-footer";
import { SITE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: `${SITE.name} — ${SITE.tagline}`,
  description: SITE.description,
  openGraph: {
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-navy-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-navy-900"
      >
        Skip to content
      </a>
      <LandingNav />
      <main id="main" className="flex-1">
        <HeroSection />
        <ValuePillars />
        <ComplianceSection />
        <SecuritySection />
        <PilotCta />
      </main>
      <LandingFooter />
    </div>
  );
}
