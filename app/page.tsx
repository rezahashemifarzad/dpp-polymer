/**
 * app/page.tsx — Corporate landing page, English ("/")
 * -----------------------------------------------------------------------
 * The root path is the public company website; German lives at /de, French at /fr
 * (app/de/page.tsx, app/fr/page.tsx). The platform (Material Ledger console) is at /app;
 * "Launch App" / "Launch Platform" link there, and "Log in" goes to /login.
 *
 * Fully static: no session, no database access, so it is prerendered at
 * build time and served from Vercel's edge cache. components/SiteNav.tsx
 * (the platform's internal nav) does not render on corporate-site paths.
 */

import { LandingPage, landingMetadata } from "@/components/landing/landing-page";

export const metadata = landingMetadata("en");

export default function EnglishLandingPage() {
  return <LandingPage locale="en" />;
}
