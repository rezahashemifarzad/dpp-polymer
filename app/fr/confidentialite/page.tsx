/**
 * app/fr/confidentialite/page.tsx — Politique de confidentialité (français).
 * English: /privacy · Deutsch: /de/datenschutz.
 * Contenu : components/landing/privacy-content.tsx.
 */

import { PrivacyContent, privacyMetadata } from "@/components/landing/privacy-content";

export const metadata = privacyMetadata("fr");

export default function ConfidentialitePage() {
  return <PrivacyContent locale="fr" />;
}
