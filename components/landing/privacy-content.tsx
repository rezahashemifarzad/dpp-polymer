/**
 * components/landing/privacy-content.tsx
 * -----------------------------------------------------------------------
 * Privacy Policy / Datenschutzerklärung / Politique de confidentialité in
 * English, German and French. Describes
 * the processing that the codebase actually performs: hosting on Vercel,
 * the PostgreSQL database in Frankfurt (Neon, AWS eu-central-1), the
 * strictly necessary `dpp_session` cookie set only on sign-in, the
 * language preference kept in localStorage, and email pilot requests.
 * There is no analytics or advertising tracking, and fonts are self-hosted
 * by next/font. Update all three languages whenever any of that changes.
 */

import type { ReactNode } from "react";
import { LegalPage } from "./legal-page";
import { corporateMetadata } from "./landing-page";
import { LEGAL_ENTITY, type SiteLocale } from "@/lib/site-config";

interface Section {
  title: string;
  body: ReactNode;
}

interface PrivacyText {
  title: string;
  description: string;
  updated: string;
  controller: string;
  email: string;
  sections: Section[];
}

const TEXT: Record<SiteLocale, PrivacyText> = {
  en: {
    title: "Privacy Policy",
    description: "How DPP-Polymer processes personal data.",
    updated: "Last updated: 8 October 2026",
    controller: "1. Controller",
    email: "Email",
    sections: [
      {
        title: "2. Visiting this website",
        body: (
          <>
            <p>
              This website and the DPP-Polymer platform are hosted by Vercel Inc. When you open a page, the hosting provider
              processes technically necessary connection data: IP address, date and time of the request, requested URL,
              referrer and browser information. This is required to deliver the website securely and to detect abuse (Art.
              6(1)(f) GDPR). Vercel acts as our processor under a data processing agreement; transfers to the United States
              are covered by the safeguards in that agreement.
            </p>
            <p>We do not use analytics, advertising or tracking tools, and fonts are served from our own domain.</p>
          </>
        ),
      },
      {
        title: "3. Cookies and local storage",
        body: (
          <>
            <ul>
              <li>
                <strong>dpp_session</strong>: a strictly necessary, HTTP-only cookie set only when you sign in. It keeps you
                signed in for up to 12 hours and is deleted when you sign out (Art. 6(1)(b) GDPR, § 25(2) TDDDG).
              </li>
              <li>
                <strong>Language preference</strong>: the language you choose is stored in your browser&apos;s local storage
                and is never sent to us.
              </li>
            </ul>
            <p>No consent banner is shown because no cookies requiring consent are used.</p>
          </>
        ),
      },
      {
        title: "4. Platform accounts and passport data",
        body: (
          <>
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
          </>
        ),
      },
      {
        title: "5. Pilot requests and email contact",
        body: (
          <p>
            If you contact us by email, for example to request a pilot, we use your details only to answer your request and,
            where a pilot follows, to prepare it (Art. 6(1)(b) GDPR). We delete the correspondence when it is no longer needed,
            unless statutory retention periods apply.
          </p>
        ),
      },
      {
        title: "6. Your rights",
        body: (
          <p>
            You have the right to access, rectification, erasure, restriction of processing, data portability and to object to
            processing based on Art. 6(1)(f) GDPR (Art. 15–21 GDPR). To exercise them, contact us at the address above. You may
            also lodge a complaint with a data protection supervisory authority, for example the authority of the German
            federal state of North Rhine-Westphalia (LDI NRW).
          </p>
        ),
      },
    ],
  },
  de: {
    title: "Datenschutzerklärung",
    description: "Wie DPP-Polymer personenbezogene Daten verarbeitet.",
    updated: "Stand: 8. Oktober 2026",
    controller: "1. Verantwortlicher",
    email: "E-Mail",
    sections: [
      {
        title: "2. Besuch dieser Website",
        body: (
          <>
            <p>
              Diese Website und die Plattform DPP-Polymer werden bei Vercel Inc. gehostet. Beim Aufruf einer Seite verarbeitet
              der Hosting-Anbieter technisch notwendige Verbindungsdaten: IP-Adresse, Datum und Uhrzeit der Anfrage, aufgerufene
              URL, Referrer und Browserinformationen. Dies ist erforderlich, um die Website sicher bereitzustellen und Missbrauch
              zu erkennen (Art. 6 Abs. 1 lit. f DSGVO). Vercel ist als Auftragsverarbeiter auf Grundlage eines
              Auftragsverarbeitungsvertrags tätig; Übermittlungen in die USA sind durch die darin vorgesehenen Garantien
              abgesichert.
            </p>
            <p>
              Wir setzen keine Analyse-, Werbe- oder Tracking-Werkzeuge ein. Schriftarten werden von unserer eigenen Domain
              ausgeliefert.
            </p>
          </>
        ),
      },
      {
        title: "3. Cookies und lokaler Speicher",
        body: (
          <>
            <ul>
              <li>
                <strong>dpp_session</strong>: ein technisch notwendiges HTTP-only-Cookie, das nur bei der Anmeldung gesetzt wird.
                Es hält Sie bis zu 12 Stunden angemeldet und wird bei der Abmeldung gelöscht (Art. 6 Abs. 1 lit. b DSGVO, § 25
                Abs. 2 TDDDG).
              </li>
              <li>
                <strong>Spracheinstellung</strong>: Die gewählte Sprache wird im lokalen Speicher Ihres Browsers abgelegt und
                nicht an uns übermittelt.
              </li>
            </ul>
            <p>Ein Einwilligungsbanner entfällt, da keine einwilligungspflichtigen Cookies verwendet werden.</p>
          </>
        ),
      },
      {
        title: "4. Plattformkonten und Passdaten",
        body: (
          <>
            <p>
              Für angemeldete Nutzer (Administration, Prüfer, Kunden und Ansprechpartner von Lieferanten) verarbeiten wir Name,
              geschäftliche E-Mail-Adresse, Organisation, Rolle sowie ein Protokoll der durchgeführten Aktionen. Dies ist zur
              Bereitstellung der Plattform im Rahmen des Vertrags mit Ihrer Organisation erforderlich (Art. 6 Abs. 1 lit. b
              DSGVO) sowie zur Führung eines manipulationssicheren Compliance-Nachweises (Art. 6 Abs. 1 lit. c und f DSGVO).
              Passwörter werden ausschließlich als gesalzene Hashwerte gespeichert.
            </p>
            <p>
              Plattformdaten werden in einer verwalteten PostgreSQL-Datenbank in Frankfurt am Main gespeichert. Da
              Compliance-Datensätze unveränderlich angelegt sind, werden Pass- und Protokolleinträge widerrufen oder ersetzt
              statt gelöscht; darin enthaltene personenbezogene Daten werden so lange aufbewahrt, wie die zugehörigen
              Produktdaten aufbewahrt werden müssen.
            </p>
          </>
        ),
      },
      {
        title: "5. Pilotanfragen und Kontakt per E-Mail",
        body: (
          <p>
            Wenn Sie uns per E-Mail kontaktieren, etwa um ein Pilotprojekt anzufragen, verwenden wir Ihre Angaben ausschließlich
            zur Beantwortung Ihrer Anfrage und gegebenenfalls zur Vorbereitung des Pilotprojekts (Art. 6 Abs. 1 lit. b DSGVO). Die
            Korrespondenz wird gelöscht, sobald sie nicht mehr benötigt wird, sofern keine gesetzlichen Aufbewahrungsfristen
            entgegenstehen.
          </p>
        ),
      },
      {
        title: "6. Ihre Rechte",
        body: (
          <p>
            Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit sowie
            auf Widerspruch gegen Verarbeitungen auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO (Art. 15–21 DSGVO). Wenden Sie sich
            dazu an die oben genannte Adresse. Zudem können Sie sich bei einer Datenschutz-Aufsichtsbehörde beschweren,
            beispielsweise bei der Landesbeauftragten für Datenschutz und Informationsfreiheit Nordrhein-Westfalen (LDI NRW).
          </p>
        ),
      },
    ],
  },
  fr: {
    title: "Politique de confidentialité",
    description: "Comment DPP-Polymer traite les données personnelles.",
    updated: "Dernière mise à jour : 8 octobre 2026",
    controller: "1. Responsable du traitement",
    email: "E-mail",
    sections: [
      {
        title: "2. Consultation de ce site",
        body: (
          <>
            <p>
              Ce site et la plateforme DPP-Polymer sont hébergés par Vercel Inc. Lors de la consultation d&apos;une page,
              l&apos;hébergeur traite les données de connexion techniquement nécessaires : adresse IP, date et heure de la
              requête, URL demandée, page de provenance et informations sur le navigateur. Ce traitement est nécessaire pour
              fournir le site de manière sécurisée et détecter les abus (art. 6, par. 1, point f du RGPD). Vercel agit en tant
              que sous-traitant dans le cadre d&apos;un contrat de traitement des données ; les transferts vers les États-Unis
              sont encadrés par les garanties prévues dans ce contrat.
            </p>
            <p>
              Nous n&apos;utilisons aucun outil d&apos;analyse, de publicité ou de suivi, et les polices de caractères sont
              servies depuis notre propre domaine.
            </p>
          </>
        ),
      },
      {
        title: "3. Cookies et stockage local",
        body: (
          <>
            <ul>
              <li>
                <strong>dpp_session</strong> : cookie strictement nécessaire, de type HTTP-only, déposé uniquement lors de la
                connexion. Il maintient votre session ouverte jusqu&apos;à 12 heures et est supprimé à la déconnexion (art. 6,
                par. 1, point b du RGPD ; § 25, al. 2 TDDDG).
              </li>
              <li>
                <strong>Préférence de langue</strong> : la langue choisie est enregistrée dans le stockage local de votre
                navigateur et ne nous est jamais transmise.
              </li>
            </ul>
            <p>Aucun bandeau de consentement n&apos;est affiché, car aucun cookie soumis à consentement n&apos;est utilisé.</p>
          </>
        ),
      },
      {
        title: "4. Comptes de la plateforme et données des passeports",
        body: (
          <>
            <p>
              Pour les utilisateurs connectés (administrateurs, auditeurs, clients et contacts fournisseurs), nous traitons le
              nom, l&apos;adresse e-mail professionnelle, l&apos;organisation, le rôle ainsi qu&apos;un journal des actions
              effectuées. Ce traitement est nécessaire à la fourniture de la plateforme dans le cadre du contrat conclu avec
              votre organisation (art. 6, par. 1, point b du RGPD) et à la tenue d&apos;un registre de conformité infalsifiable
              (art. 6, par. 1, points c et f du RGPD). Les mots de passe sont uniquement stockés sous forme de hachages salés.
            </p>
            <p>
              Les données de la plateforme sont stockées dans une base de données PostgreSQL managée hébergée à Francfort
              (Allemagne). Les enregistrements de conformité étant conçus pour être immuables, les entrées de passeport et
              d&apos;audit sont révoquées ou remplacées plutôt que supprimées ; les données personnelles qu&apos;elles contiennent
              sont conservées aussi longtemps que les données produit correspondantes doivent l&apos;être.
            </p>
          </>
        ),
      },
      {
        title: "5. Demandes de pilote et contact par e-mail",
        body: (
          <p>
            Si vous nous contactez par e-mail, par exemple pour demander un projet pilote, nous utilisons vos informations
            uniquement pour répondre à votre demande et, le cas échéant, pour préparer le pilote (art. 6, par. 1, point b du
            RGPD). La correspondance est supprimée lorsqu&apos;elle n&apos;est plus nécessaire, sauf obligation légale de
            conservation.
          </p>
        ),
      },
      {
        title: "6. Vos droits",
        body: (
          <p>
            Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de limitation du traitement, de
            portabilité des données et d&apos;opposition aux traitements fondés sur l&apos;art. 6, par. 1, point f du RGPD
            (art. 15 à 21 du RGPD). Pour les exercer, contactez-nous à l&apos;adresse indiquée ci-dessus. Vous pouvez également
            introduire une réclamation auprès d&apos;une autorité de contrôle de la protection des données, par exemple
            l&apos;autorité du Land de Rhénanie-du-Nord-Westphalie (LDI NRW) ou la CNIL.
          </p>
        ),
      },
    ],
  },
};

export function privacyMetadata(locale: SiteLocale) {
  const t = TEXT[locale];
  return corporateMetadata(locale, "privacy", `${t.title} · DPP-Polymer`, t.description);
}

export function PrivacyContent({ locale }: { locale: SiteLocale }) {
  const t = TEXT[locale];
  const e = LEGAL_ENTITY;
  const controllerLines = [e.companyName, e.representative, e.street, e.postalCodeAndCity, e.country[locale]].filter(Boolean);

  return (
    <LegalPage locale={locale} page="privacy" title={t.title} updated={t.updated}>
      <section>
        <h2>{t.controller}</h2>
        <address className="not-italic">
          {controllerLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>
        {e.email && (
          <p>
            {t.email}: <a href={`mailto:${e.email}`}>{e.email}</a>
          </p>
        )}
      </section>
      {t.sections.map((s) => (
        <section key={s.title}>
          <h2>{s.title}</h2>
          {s.body}
        </section>
      ))}
    </LegalPage>
  );
}
