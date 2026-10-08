/**
 * app/imprint/page.tsx — Imprint (Impressum, § 5 DDG)
 * -----------------------------------------------------------------------
 * Renders the legal entity details from lib/site-config.ts. Fields left
 * empty there are omitted rather than filled with invented data — complete
 * LEGAL_ENTITY (address, register entry, VAT ID) before going live.
 */

import type { Metadata } from "next";
import { LegalPage } from "@/components/landing/legal-page";
import { LEGAL_ENTITY } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Imprint · DPP-Polymer",
  description: "Legal notice (Impressum) for DPP-Polymer.",
};

export default function ImprintPage() {
  const e = LEGAL_ENTITY;
  const addressLines = [e.companyName, e.street, e.postalCodeAndCity, e.country].filter(Boolean);

  return (
    <LegalPage title="Imprint">
      <section>
        <h2>Information pursuant to § 5 DDG</h2>
        <address className="not-italic">
          {addressLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>
        {e.representative && <p>Represented by: {e.representative}</p>}
      </section>

      <section>
        <h2>Contact</h2>
        <ul>
          {e.email && (
            <li>
              Email: <a href={`mailto:${e.email}`}>{e.email}</a>
            </li>
          )}
          {e.phone && <li>Phone: {e.phone}</li>}
        </ul>
      </section>

      {(e.commercialRegister || e.vatId) && (
        <section>
          <h2>Register and tax information</h2>
          <ul>
            {e.commercialRegister && <li>Commercial register: {e.commercialRegister}</li>}
            {e.vatId && <li>VAT identification number pursuant to § 27a UStG: {e.vatId}</li>}
          </ul>
        </section>
      )}

      {e.contentResponsible && (
        <section>
          <h2>Responsible for content pursuant to § 18 (2) MStV</h2>
          <p>{e.contentResponsible}</p>
          <address className="not-italic">
            {[e.street, e.postalCodeAndCity].filter(Boolean).map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
        </section>
      )}

      <section>
        <h2>Consumer dispute resolution</h2>
        <p>
          We are neither willing nor obliged to participate in dispute resolution proceedings before a consumer
          arbitration board.
        </p>
      </section>
    </LegalPage>
  );
}
