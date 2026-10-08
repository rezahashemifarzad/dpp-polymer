/**
 * app/fr/page.tsx — Corporate landing page, French ("/fr")
 * -----------------------------------------------------------------------
 * Same page as app/page.tsx with French copy from
 * lib/i18n/landing-dictionary.ts. Static, prerendered at build time.
 */

import { LandingPage, landingMetadata } from "@/components/landing/landing-page";

export const metadata = landingMetadata("fr");

export default function FrenchLandingPage() {
  return <LandingPage locale="fr" />;
}
