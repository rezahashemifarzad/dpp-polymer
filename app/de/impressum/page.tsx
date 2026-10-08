/**
 * app/de/impressum/page.tsx — Impressum (Deutsch). English: /imprint.
 * Inhalt: components/landing/imprint-content.tsx; Daten: lib/site-config.ts.
 */

import { ImprintContent, imprintMetadata } from "@/components/landing/imprint-content";

export const metadata = imprintMetadata("de");

export default function ImpressumPage() {
  return <ImprintContent locale="de" />;
}
