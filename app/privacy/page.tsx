/**
 * app/privacy/page.tsx — Privacy Policy
 * -----------------------------------------------------------------------
 * Describes the processing that the codebase actually performs: hosting on
 * Vercel, the PostgreSQL database in Frankfurt (Neon, AWS eu-central-1),
 * the strictly necessary `dpp_session` cookie set only on sign-in, the
 * language preference kept in localStorage, and email pilot requests.
 * There is no analytics or advertising tracking, and fonts are self-hosted
 * by next/font. Update this page whenever any of that changes.
 */

import type { Metadata } from "next";
import { LegalPage } from "@/components/landing/legal-page";
import { LEGAL_ENTITY } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Privacy Policy · DPP-Polymer",
  description: "How DPP-Polymer processes personal data.",
};

export default function PrivacyPage() {
  const e = LEGAL_ENTITY;
  const controllerLines = [e.companyName, e.representative, e.street, e.postalCodeAndCity, e.country].filter(Boolean);

  return (
    <LegalPage title="Privacy Policy" updated="8 October 2026">
      <section>
        <h2>1. Controller</h2>
        <address className="not-italic">
          {controllerLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>
        {e.email && (
          <p>
            Email: <a href={`mailto:${e.email}`}>{e.email}</a>
          </p>
        )}
      </section>

      <section>
        <h2>2. Visiting this website</h2>
        <p>
          This website and the DPP-Polymer platform are hosted by Vercel Inc. When you open a page, the hosting provider
          processes technically necessary connection data: IP address, date and time of the request, requested URL,
          referrer and browser information. This is required to deliver the website securely and to detect abuse (Art.
          6(1)(f) GDPR). Vercel acts as our processor under a data processing agreement; transfers to the United States
          are covered by the safeguards in that agreement.
        </p>
        <p>We do not use analytics, advertising or tracking tools, and fonts are served from our own domain.</p>
      </section>

      <section>
        <h2>3. Cookies and local storage</h2>
        <ul>
          <li>
            <strong>dpp_session</strong>: a strictly necessary, HTTP-only cookie set only when you sign in. It keeps you
            signed in for up to 12 hours and is deleted when you sign out (Art. 6(1)(b) GDPR, § 25(2) TDDDG).
          </li>
          <li>
            <strong>Language preference</strong>: the platform language you choose is stored in your browser&apos;s local
            storage and is never sent to us.
          </li>
        </ul>
        <p>No consent banner is shown because no cookies requiring consent are used.</p>
      </section>

      <section>
        <h2>4. Platform accounts and passport data</h2>
        <p>
          For signed-in users (administrators, auditors, customers and supplier contacts) we process name, business email
          address, organisation, role and an audit record of the actions performed. This is necessary to provide the
          platform under the contract with your organisation (Art. 6(1)(b) GDPR) and to keep a tamper-evident compliance
          record (Art. 6(1)(c) and (f) GDPR). Passwords are stored only as salted hashes.
        </p>
        <p>
          Platform data is stored in a managed PostgreSQL database hosted in Frankfurt, Germany. Because compliance records
          are designed to be immutable, passport and audit entries are revoked or superseded rather than deleted; personal
          data in them is kept for as long as the related product records must be retained.
        </p>
      </section>

      <section>
        <h2>5. Pilot requests and email contact</h2>
        <p>
          If you contact us by email, for example to request a pilot, we use your details only to answer your request and,
          where a pilot follows, to prepare it (Art. 6(1)(b) GDPR). We delete the correspondence when it is no longer needed,
          unless statutory retention periods apply.
        </p>
      </section>

      <section>
        <h2>6. Your rights</h2>
        <p>
          You have the right to access, rectification, erasure, restriction of processing, data portability and to object to
          processing based on Art. 6(1)(f) GDPR (Art. 15–21 GDPR). To exercise them, contact us at the address above. You may
          also lodge a complaint with a data protection supervisory authority, for example the authority of the German
          federal state of North Rhine-Westphalia (LDI NRW).
        </p>
      </section>
    </LegalPage>
  );
}
