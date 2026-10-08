/**
 * app/imprint/page.tsx — Imprint (English). German: /de/impressum.
 * Content: components/landing/imprint-content.tsx; data: lib/site-config.ts.
 */

import { ImprintContent, imprintMetadata } from "@/components/landing/imprint-content";

export const metadata = imprintMetadata("en");

export default function ImprintPage() {
  return <ImprintContent locale="en" />;
}
