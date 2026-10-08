/**
 * app/privacy/page.tsx — Privacy Policy (English). German: /de/datenschutz.
 * Content: components/landing/privacy-content.tsx.
 */

import { PrivacyContent, privacyMetadata } from "@/components/landing/privacy-content";

export const metadata = privacyMetadata("en");

export default function PrivacyPage() {
  return <PrivacyContent locale="en" />;
}
