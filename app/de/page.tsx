/**
 * app/de/page.tsx — Corporate landing page, German ("/de")
 * -----------------------------------------------------------------------
 * Same page as app/page.tsx with German copy from
 * lib/i18n/landing-dictionary.ts. Static, prerendered at build time.
 */

import { LandingPage, landingMetadata } from "@/components/landing/landing-page";

export const metadata = landingMetadata("de");

export default function GermanLandingPage() {
  return <LandingPage locale="de" />;
}
