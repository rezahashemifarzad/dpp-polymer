/**
 * app/fr/mentions-legales/page.tsx — Mentions légales (français).
 * English: /imprint · Deutsch: /de/impressum.
 * Contenu : components/landing/imprint-content.tsx ; données : lib/site-config.ts.
 */

import { ImprintContent, imprintMetadata } from "@/components/landing/imprint-content";

export const metadata = imprintMetadata("fr");

export default function MentionsLegalesPage() {
  return <ImprintContent locale="fr" />;
}
