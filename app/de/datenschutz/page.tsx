/**
 * app/de/datenschutz/page.tsx — Datenschutzerklärung (Deutsch). English: /privacy.
 * Inhalt: components/landing/privacy-content.tsx.
 */

import { PrivacyContent, privacyMetadata } from "@/components/landing/privacy-content";

export const metadata = privacyMetadata("de");

export default function DatenschutzPage() {
  return <PrivacyContent locale="de" />;
}
