/**
 * components/landing/imprint-content.tsx
 * -----------------------------------------------------------------------
 * Imprint / Impressum / Mentions légales (§ 5 DDG) in English, German and
 * French. Renders the legal
 * entity details from lib/site-config.ts; fields left empty there are
 * omitted rather than filled with invented data.
 *
 * Pre-incorporation (LEGAL_ENTITY.inFormation): the provider is the founder
 * personally, so the § 5 DDG block names the founder first, followed by the
 * project name "DPP-Polymer (in Gründung)" and the address, and a "Legal
 * status" section explains that no company is registered yet. The register
 * and VAT section stays hidden until those fields are filled in.
 */

import { LegalPage } from "./legal-page";
import { corporateMetadata } from "./landing-page";
import { LEGAL_ENTITY, type SiteLocale } from "@/lib/site-config";

const TEXT: Record<
  SiteLocale,
  {
    title: string;
    description: string;
    info: string;
    representedBy: string;
    statusTitle: string;
    contact: string;
    email: string;
    phone: string;
    register: string;
    commercialRegister: string;
    vatId: string;
    responsible: string;
    disputeTitle: string;
    disputeBody: string;
  }
> = {
  en: {
    title: "Imprint",
    description: "Legal notice (Impressum) for DPP-Polymer.",
    info: "Information pursuant to § 5 DDG",
    representedBy: "Represented by",
    statusTitle: "Legal status",
    contact: "Contact",
    email: "Email",
    phone: "Phone",
    register: "Register and tax information",
    commercialRegister: "Commercial register",
    vatId: "VAT identification number pursuant to § 27a UStG",
    responsible: "Responsible for content pursuant to § 18 (2) MStV",
    disputeTitle: "Consumer dispute resolution",
    disputeBody:
      "We are neither willing nor obliged to participate in dispute resolution proceedings before a consumer arbitration board.",
  },
  de: {
    title: "Impressum",
    description: "Impressum von DPP-Polymer.",
    info: "Angaben gemäß § 5 DDG",
    representedBy: "Vertreten durch",
    statusTitle: "Rechtlicher Status",
    contact: "Kontakt",
    email: "E-Mail",
    phone: "Telefon",
    register: "Register- und Steuerangaben",
    commercialRegister: "Handelsregister",
    vatId: "Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG",
    responsible: "Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV",
    disputeTitle: "Verbraucherstreitbeilegung",
    disputeBody:
      "Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
  },
  fr: {
    title: "Mentions légales",
    description: "Mentions légales de DPP-Polymer.",
    info: "Informations conformément au § 5 DDG (loi allemande sur les services numériques)",
    representedBy: "Représentée par",
    statusTitle: "Statut juridique",
    contact: "Contact",
    email: "E-mail",
    phone: "Téléphone",
    register: "Informations d'immatriculation et fiscales",
    commercialRegister: "Registre du commerce",
    vatId: "Numéro d'identification à la TVA selon le § 27a UStG",
    responsible: "Responsable du contenu selon le § 18, al. 2 MStV",
    disputeTitle: "Règlement des litiges de consommation",
    disputeBody:
      "Nous ne sommes ni disposés ni tenus de participer à une procédure de règlement des litiges devant un organisme de médiation de la consommation.",
  },
};

export function imprintMetadata(locale: SiteLocale) {
  const t = TEXT[locale];
  return corporateMetadata(locale, "imprint", `${t.title} · DPP-Polymer`, t.description);
}

export function ImprintContent({ locale }: { locale: SiteLocale }) {
  const t = TEXT[locale];
  const e = LEGAL_ENTITY;
  // Before incorporation the founder is the provider, so their name leads the block.
  const addressLines = (
    e.inFormation
      ? [e.representative, e.companyName, e.street, e.postalCodeAndCity, e.country[locale]]
      : [e.companyName, e.street, e.postalCodeAndCity, e.country[locale]]
  ).filter(Boolean);
  const statusNote = e.inFormation ? e.legalStatus[locale] : "";
  const streetLines = [e.street, e.postalCodeAndCity].filter(Boolean);

  return (
    <LegalPage locale={locale} page="imprint" title={t.title}>
      <section>
        <h2>{t.info}</h2>
        <address className="not-italic">
          {addressLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>
        {!e.inFormation && e.representative && (
          <p>
            {t.representedBy}: {e.representative}
          </p>
        )}
      </section>

      {statusNote && (
        <section aria-labelledby="imprint-legal-status">
          <h2 id="imprint-legal-status">{t.statusTitle}</h2>
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-[14.5px] leading-[1.7] text-slate-700">
            {statusNote}
          </p>
        </section>
      )}

      <section>
        <h2>{t.contact}</h2>
        <ul>
          {e.email && (
            <li>
              {t.email}: <a href={`mailto:${e.email}`}>{e.email}</a>
            </li>
          )}
          {e.phone && (
            <li>
              {t.phone}: {e.phone}
            </li>
          )}
        </ul>
      </section>

      {(e.commercialRegister || e.vatId) && (
        <section>
          <h2>{t.register}</h2>
          <ul>
            {e.commercialRegister && (
              <li>
                {t.commercialRegister}: {e.commercialRegister}
              </li>
            )}
            {e.vatId && (
              <li>
                {t.vatId}: {e.vatId}
              </li>
            )}
          </ul>
        </section>
      )}

      {e.contentResponsible && (
        <section>
          <h2>{t.responsible}</h2>
          <p>{e.contentResponsible}</p>
          {streetLines.length > 0 && (
            <address className="not-italic">
              {streetLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
          )}
        </section>
      )}

      <section>
        <h2>{t.disputeTitle}</h2>
        <p>{t.disputeBody}</p>
      </section>
    </LegalPage>
  );
}
