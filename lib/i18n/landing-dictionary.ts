/**
 * lib/i18n/landing-dictionary.ts
 * -----------------------------------------------------------------------
 * All copy for the public corporate website in English, German and French.
 * The landing page is server-rendered per language (/, /de and /fr), so this is a
 * plain typed object read at build time rather than the platform's
 * client-side useLanguage() dictionary. `LandingCopy` is the contract: a
 * missing or extra field in either language is a type error.
 *
 * German copy uses the formal "Sie"; German and French use their own number
 * formatting (decimal comma).
 */

import type { SiteLocale } from "@/lib/site-config";

export interface LandingCopy {
  meta: { title: string; description: string };
  a11y: { skipToContent: string; mainNav: string; openMenu: string; languageSwitch: string; home: string };
  nav: { features: string; compliance: string; security: string; login: string; launchApp: string };
  hero: { eyebrow: string; title: string; lead: string; requestPilot: string; launchPlatform: string };
  trust: { label: string; items: { title: string; detail: string }[] };
  passport: {
    kicker: string;
    title: string;
    status: string;
    pcr: string;
    properties: { label: string; detail: string; value: string; unit: string }[];
    checks: string[];
    sampleNote: string;
  };
  features: {
    eyebrow: string;
    title: string;
    lead: string;
    pillars: { title: string; summary: string; points: string[] }[];
  };
  compliance: {
    eyebrow: string;
    title: string;
    lead: string;
    caption: string;
    columns: { framework: string; reference: string; coverage: string };
    frameworks: { name: string; reference: string; coverage: string }[];
    disclaimer: string;
  };
  security: {
    eyebrow: string;
    title: string;
    lead: string;
    rolesHeading: string;
    integrityHeading: string;
    roles: { name: string; access: string }[];
    guarantees: { title: string; body: string }[];
  };
  pilot: {
    title: string;
    lead: string;
    requestPilot: string;
    launchPlatform: string;
    steps: { title: string; body: string }[];
  };
  footer: {
    tagline: string;
    product: string;
    platform: string;
    legal: string;
    imprint: string;
    privacy: string;
    rights: string;
    closing: string;
  };
}

const EN: LandingCopy = {
  meta: {
    title: "DPP-Polymer — Digital Product Passports for polymers and recyclates",
    description:
      "EU-compliant Digital Product Passports for the polymer and plastics industry: ESPR and PPWR data, REACH SVHC declarations, ISCC PLUS chain of custody and GS1 Digital Link QR codes, secured by role-based access control.",
  },
  a11y: {
    skipToContent: "Skip to content",
    mainNav: "Main",
    openMenu: "Open menu",
    languageSwitch: "Language",
    home: "DPP-Polymer home",
  },
  nav: { features: "Features", compliance: "Compliance", security: "Security", login: "Log in", launchApp: "Launch App" },
  hero: {
    eyebrow: "Built for EU ESPR & PPWR",
    title: "Verifiable product passports for polymers and recyclates.",
    lead: "DPP-Polymer turns batch data from compounders and recyclers into audit-ready Digital Product Passports: material properties, recycled content, carbon footprint and chain of custody, published through a standard GS1 QR code.",
    requestPilot: "Request Pilot",
    launchPlatform: "Launch Platform",
  },
  trust: {
    label: "Built for European industrial supply chains",
    items: [
      { title: "ESPR-ready", detail: "Reg. (EU) 2024/1781" },
      { title: "PPWR recycled content", detail: "Reg. (EU) 2025/40" },
      { title: "Hosted in Frankfurt", detail: "EU data residency" },
      { title: "Role-based access", detail: "Enforced server-side" },
      { title: "Tamper-evident", detail: "SHA-256 sealed records" },
    ],
  },
  passport: {
    kicker: "Digital Product Passport",
    title: "rPP compound · Batch RP-2026-0418",
    status: "Issued",
    pcr: "Post-consumer recycled content",
    properties: [
      { label: "Melt flow rate", detail: "ISO 1133 · 230 °C / 2.16 kg", value: "12.0", unit: "g/10 min" },
      { label: "Density", detail: "ISO 1183", value: "0.905", unit: "g/cm³" },
      { label: "Carbon footprint", detail: "Cradle-to-gate, PEF", value: "1.42", unit: "kg CO₂e/kg" },
    ],
    checks: [
      "REACH: no SVHC above 0.1 % w/w",
      "ISCC PLUS mass balance — auditor verified",
      "PPWR recycled-content declaration filed",
    ],
    sampleNote: "Illustrative sample data",
  },
  features: {
    eyebrow: "Platform",
    title: "Compliance, access control and traceability in one system.",
    lead: "Replace spreadsheets, PDFs and email chains with a single verified record that travels with every batch.",
    pillars: [
      {
        title: "ESPR & PPWR compliance",
        summary: "One structured passport per batch, aligned with the data requirements of the EU Digital Product Passport.",
        points: [
          "Recycled-content (PCR/PIR) and PPWR declarations",
          "REACH SVHC declarations with automatic alerts",
          "Compliance reports and ledger exports (PDF, Excel)",
        ],
      },
      {
        title: "Secure role-based access",
        summary: "Every role sees exactly what it needs: administrators, auditors, customers, suppliers and the public.",
        points: [
          "Authorization enforced on the server for every request",
          "Customers see only their own purchased batches",
          "Auditors verify records without admin rights",
        ],
      },
      {
        title: "Supply-chain traceability",
        summary: "Follow material from feedstock to finished compound, with every handover documented.",
        points: [
          "ISCC PLUS chain-of-custody records, auditor-verified",
          "Batch genealogy linking parent and child batches",
          "Supplier onboarding via secure single-use links",
        ],
      },
    ],
  },
  compliance: {
    eyebrow: "Compliance",
    title: "Built around the regulations your customers will ask about.",
    lead: "Each passport field maps to a requirement, so auditors and buyers get answers instead of attachments.",
    caption: "Regulations and standards supported by DPP-Polymer",
    columns: { framework: "Framework", reference: "Reference", coverage: "What DPP-Polymer records" },
    frameworks: [
      {
        name: "ESPR",
        reference: "Regulation (EU) 2024/1781",
        coverage:
          "Structured passport per batch with a unique identifier, a QR data carrier resolving to a public passport, and lifecycle states (issued, revoked, superseded) that never delete history.",
      },
      {
        name: "PPWR",
        reference: "Regulation (EU) 2025/40",
        coverage: "Post-consumer and post-industrial recycled-content shares and per-batch packaging compliance declarations.",
      },
      {
        name: "REACH",
        reference: "Regulation (EC) No 1907/2006",
        coverage: "Substance of Very High Concern declarations above 0.1 % w/w, with portfolio-wide alerts.",
      },
      {
        name: "ISCC PLUS",
        reference: "Mass-balance chain of custody",
        coverage: "Chain-of-custody records and certificates reviewed by named auditors, with expiry monitoring.",
      },
      {
        name: "GS1 Digital Link",
        reference: "ISO/IEC 18975",
        coverage: "Standard web URIs per GTIN and batch, printed as QR labels for packaging and delivery documents.",
      },
      {
        name: "Product carbon footprint",
        reference: "Cradle-to-gate, kg CO₂e/kg",
        coverage:
          "Footprint per batch from feedstock and process inputs, calculated with exact decimal arithmetic and stored with the passport.",
      },
    ],
    disclaimer:
      "DPP-Polymer supports your compliance documentation. Responsibility for the accuracy of declarations remains with the manufacturer or economic operator placing the product on the market.",
  },
  security: {
    eyebrow: "Security",
    title: "Least privilege for every participant in the chain.",
    lead: "Supply-chain data is commercially sensitive. Access is scoped by role and enforced on the server, not just hidden in the interface.",
    rolesHeading: "Roles",
    integrityHeading: "Integrity",
    roles: [
      { name: "Administrator", access: "Creates and manages passports, accounts and settings." },
      { name: "Auditor", access: "Verifies certificates and custody records; reads audit trails." },
      { name: "Customer", access: "Sees only the batches it has purchased." },
      { name: "Supplier", access: "Submits batch data through a single-use invitation for review." },
      { name: "Public", access: "Scans the QR code and reads the issued passport only." },
    ],
    guarantees: [
      {
        title: "Deny by default",
        body: "Every API route and server action checks the caller's session or key on the server. A release that adds an unprotected endpoint fails its build.",
      },
      {
        title: "Tamper-evident records",
        body: "Passports are sealed with SHA-256 and every change is written to a hash-linked audit log that can be re-verified at any time. Records are revoked or superseded, never deleted.",
      },
      {
        title: "EU data residency",
        body: "Passport data is stored in a managed PostgreSQL database in Frankfurt, Germany, and served only over encrypted connections.",
      },
    ],
  },
  pilot: {
    title: "Start with a pilot on your next production batch.",
    lead: "We work with polymer compounders and recyclers to issue their first passports on real material, so the data is in place before customers and regulators ask for it.",
    requestPilot: "Request Pilot",
    launchPlatform: "Launch Platform",
    steps: [
      { title: "Scope", body: "Pick one product line and the passport fields your customers ask for." },
      { title: "Onboard", body: "Import batch data from your ERP or invite suppliers to submit it." },
      { title: "Issue", body: "Publish passports, print GS1 QR labels and share access with auditors and buyers." },
    ],
  },
  footer: {
    tagline: "Digital Product Passports for polymers and recyclates.",
    product: "Product",
    platform: "Platform",
    legal: "Legal",
    imprint: "Imprint",
    privacy: "Privacy Policy",
    rights: "All rights reserved.",
    closing: "Digital Product Passports for the European polymer industry.",
  },
};

const DE: LandingCopy = {
  meta: {
    title: "DPP-Polymer — Digitale Produktpässe für Kunststoffe und Rezyklate",
    description:
      "EU-konforme Digitale Produktpässe für die Kunststoffindustrie: ESPR- und PPWR-Daten, REACH-SVHC-Erklärungen, ISCC-PLUS-Lieferkettennachweise und GS1-Digital-Link-QR-Codes, abgesichert durch rollenbasierte Zugriffskontrolle.",
  },
  a11y: {
    skipToContent: "Zum Inhalt springen",
    mainNav: "Hauptnavigation",
    openMenu: "Menü öffnen",
    languageSwitch: "Sprache",
    home: "DPP-Polymer Startseite",
  },
  nav: { features: "Funktionen", compliance: "Compliance", security: "Sicherheit", login: "Anmelden", launchApp: "App öffnen" },
  hero: {
    eyebrow: "Entwickelt für EU-ESPR & PPWR",
    title: "Verifizierbare Produktpässe für Kunststoffe und Rezyklate.",
    lead: "DPP-Polymer macht aus den Chargendaten von Compoundeuren und Recyclern prüffähige Digitale Produktpässe: Materialeigenschaften, Rezyklatanteil, CO₂-Fußabdruck und Lieferkettennachweis, veröffentlicht über einen standardisierten GS1-QR-Code.",
    requestPilot: "Pilotprojekt anfragen",
    launchPlatform: "Plattform öffnen",
  },
  trust: {
    label: "Entwickelt für europäische Industrie-Lieferketten",
    items: [
      { title: "ESPR-bereit", detail: "VO (EU) 2024/1781" },
      { title: "PPWR-Rezyklatanteil", detail: "VO (EU) 2025/40" },
      { title: "Hosting in Frankfurt", detail: "Datenhaltung in der EU" },
      { title: "Rollenbasierter Zugriff", detail: "Serverseitig durchgesetzt" },
      { title: "Manipulationssicher", detail: "SHA-256-versiegelt" },
    ],
  },
  passport: {
    kicker: "Digitaler Produktpass",
    title: "rPP-Compound · Charge RP-2026-0418",
    status: "Ausgestellt",
    pcr: "Post-Consumer-Rezyklatanteil",
    properties: [
      { label: "Schmelze-Massefließrate", detail: "ISO 1133 · 230 °C / 2,16 kg", value: "12,0", unit: "g/10 min" },
      { label: "Dichte", detail: "ISO 1183", value: "0,905", unit: "g/cm³" },
      { label: "CO₂-Fußabdruck", detail: "Cradle-to-Gate, PEF", value: "1,42", unit: "kg CO₂e/kg" },
    ],
    checks: [
      "REACH: kein SVHC über 0,1 % (w/w)",
      "ISCC PLUS Massenbilanz — vom Prüfer verifiziert",
      "PPWR-Rezyklaterklärung hinterlegt",
    ],
    sampleNote: "Beispieldaten zur Veranschaulichung",
  },
  features: {
    eyebrow: "Plattform",
    title: "Compliance, Zugriffskontrolle und Rückverfolgbarkeit in einem System.",
    lead: "Ersetzen Sie Tabellen, PDFs und E-Mail-Ketten durch einen einzigen verifizierten Datensatz, der jede Charge begleitet.",
    pillars: [
      {
        title: "ESPR- & PPWR-Compliance",
        summary: "Ein strukturierter Produktpass pro Charge, ausgerichtet auf die Datenanforderungen des EU-Produktpasses.",
        points: [
          "Rezyklatanteile (PCR/PIR) und PPWR-Erklärungen",
          "REACH-SVHC-Erklärungen mit automatischen Warnungen",
          "Compliance-Berichte und Exporte (PDF, Excel)",
        ],
      },
      {
        title: "Sicherer rollenbasierter Zugriff",
        summary: "Jede Rolle sieht genau das, was sie braucht: Administration, Prüfer, Kunden, Lieferanten und Öffentlichkeit.",
        points: [
          "Autorisierung serverseitig bei jeder Anfrage",
          "Kunden sehen nur ihre eigenen Chargen",
          "Prüfer verifizieren ohne Administratorrechte",
        ],
      },
      {
        title: "Rückverfolgbare Lieferkette",
        summary: "Verfolgen Sie Material vom Rohstoff bis zum fertigen Compound – jede Übergabe ist dokumentiert.",
        points: [
          "ISCC-PLUS-Lieferkettennachweise, vom Prüfer verifiziert",
          "Chargengenealogie zwischen Vor- und Folgechargen",
          "Lieferanten-Onboarding über sichere Einmal-Links",
        ],
      },
    ],
  },
  compliance: {
    eyebrow: "Compliance",
    title: "Ausgerichtet auf die Vorschriften, nach denen Ihre Kunden fragen.",
    lead: "Jedes Feld im Produktpass ist einer Anforderung zugeordnet – Prüfer und Einkäufer erhalten Antworten statt Anhänge.",
    caption: "Von DPP-Polymer unterstützte Vorschriften und Standards",
    columns: { framework: "Rahmenwerk", reference: "Referenz", coverage: "Was DPP-Polymer erfasst" },
    frameworks: [
      {
        name: "ESPR",
        reference: "Verordnung (EU) 2024/1781",
        coverage:
          "Strukturierter Produktpass pro Charge mit eindeutiger Kennung, QR-Datenträger mit Verweis auf den öffentlichen Pass und Lebenszyklusstatus (ausgestellt, widerrufen, ersetzt), ohne die Historie zu löschen.",
      },
      {
        name: "PPWR",
        reference: "Verordnung (EU) 2025/40",
        coverage: "Anteile an Post-Consumer- und Post-Industrial-Rezyklat sowie Konformitätserklärungen für Verpackungen je Charge.",
      },
      {
        name: "REACH",
        reference: "Verordnung (EG) Nr. 1907/2006",
        coverage: "Erklärungen zu besonders besorgniserregenden Stoffen (SVHC) über 0,1 % (w/w) mit portfolioweiten Warnungen.",
      },
      {
        name: "ISCC PLUS",
        reference: "Massenbilanz-Lieferkette",
        coverage: "Lieferkettennachweise und Zertifikate, geprüft durch benannte Prüfer, mit Überwachung der Gültigkeit.",
      },
      {
        name: "GS1 Digital Link",
        reference: "ISO/IEC 18975",
        coverage: "Standardisierte Web-URIs pro GTIN und Charge, gedruckt als QR-Etiketten für Verpackungen und Lieferpapiere.",
      },
      {
        name: "Produkt-CO₂-Fußabdruck",
        reference: "Cradle-to-Gate, kg CO₂e/kg",
        coverage:
          "Fußabdruck pro Charge aus Rohstoff- und Prozessdaten, mit exakter Dezimalarithmetik berechnet und im Pass gespeichert.",
      },
    ],
    disclaimer:
      "DPP-Polymer unterstützt Ihre Compliance-Dokumentation. Die Verantwortung für die Richtigkeit der Angaben verbleibt beim Hersteller bzw. beim Wirtschaftsakteur, der das Produkt in Verkehr bringt.",
  },
  security: {
    eyebrow: "Sicherheit",
    title: "Minimale Rechte für jeden Beteiligten der Lieferkette.",
    lead: "Lieferkettendaten sind geschäftskritisch. Zugriffe sind nach Rollen begrenzt und werden auf dem Server durchgesetzt – nicht nur in der Oberfläche ausgeblendet.",
    rolesHeading: "Rollen",
    integrityHeading: "Integrität",
    roles: [
      { name: "Administrator", access: "Erstellt und verwaltet Produktpässe, Konten und Einstellungen." },
      { name: "Prüfer", access: "Verifiziert Zertifikate und Lieferkettennachweise; liest Audit-Protokolle." },
      { name: "Kunde", access: "Sieht ausschließlich die selbst erworbenen Chargen." },
      { name: "Lieferant", access: "Übermittelt Chargendaten über eine Einmal-Einladung zur Prüfung." },
      { name: "Öffentlichkeit", access: "Scannt den QR-Code und sieht nur den ausgestellten Pass." },
    ],
    guarantees: [
      {
        title: "Standardmäßig gesperrt",
        body: "Jede API-Route und jede Server-Aktion prüft Sitzung oder Schlüssel des Aufrufers auf dem Server. Ein Release mit ungeschütztem Endpunkt schlägt bereits beim Build fehl.",
      },
      {
        title: "Manipulationssichere Datensätze",
        body: "Produktpässe werden mit SHA-256 versiegelt, und jede Änderung wird in einem hashverketteten Audit-Protokoll festgehalten, das jederzeit erneut geprüft werden kann. Datensätze werden widerrufen oder ersetzt, nie gelöscht.",
      },
      {
        title: "Datenhaltung in der EU",
        body: "Passdaten liegen in einer verwalteten PostgreSQL-Datenbank in Frankfurt am Main und werden ausschließlich verschlüsselt übertragen.",
      },
    ],
  },
  pilot: {
    title: "Starten Sie mit einem Pilotprojekt auf Ihrer nächsten Produktionscharge.",
    lead: "Wir begleiten Compoundeure und Recycler bei ihren ersten Produktpässen auf echtem Material – damit die Daten bereitstehen, bevor Kunden und Behörden danach fragen.",
    requestPilot: "Pilotprojekt anfragen",
    launchPlatform: "Plattform öffnen",
    steps: [
      { title: "Umfang festlegen", body: "Wählen Sie eine Produktlinie und die Passfelder, nach denen Ihre Kunden fragen." },
      { title: "Daten anbinden", body: "Importieren Sie Chargendaten aus Ihrem ERP oder laden Sie Lieferanten zur Eingabe ein." },
      { title: "Ausstellen", body: "Veröffentlichen Sie Produktpässe, drucken Sie GS1-QR-Etiketten und geben Sie Prüfern und Einkäufern Zugriff." },
    ],
  },
  footer: {
    tagline: "Digitale Produktpässe für Kunststoffe und Rezyklate.",
    product: "Produkt",
    platform: "Plattform",
    legal: "Rechtliches",
    imprint: "Impressum",
    privacy: "Datenschutz",
    rights: "Alle Rechte vorbehalten.",
    closing: "Digitale Produktpässe für die europäische Kunststoffindustrie.",
  },
};

const FR: LandingCopy = {
  meta: {
    title: "DPP-Polymer — Passeports numériques de produits pour polymères et recyclats",
    description:
      "Passeports numériques de produits conformes aux exigences européennes pour l'industrie des polymères et des plastiques : données ESPR et PPWR, déclarations SVHC au titre de REACH, chaîne de traçabilité ISCC PLUS et QR codes GS1 Digital Link, sécurisés par un contrôle d'accès basé sur les rôles.",
  },
  a11y: {
    skipToContent: "Aller au contenu",
    mainNav: "Navigation principale",
    openMenu: "Ouvrir le menu",
    languageSwitch: "Langue",
    home: "Accueil DPP-Polymer",
  },
  nav: { features: "Fonctionnalités", compliance: "Conformité", security: "Sécurité", login: "Connexion", launchApp: "Ouvrir l'application" },
  hero: {
    eyebrow: "Conçu pour l'ESPR et le PPWR européens",
    title: "Des passeports produits vérifiables pour les polymères et les recyclats.",
    lead: "DPP-Polymer transforme les données de lots des compoundeurs et des recycleurs en passeports numériques de produits prêts pour l'audit : propriétés des matériaux, teneur en recyclé, empreinte carbone et chaîne de traçabilité, publiés via un QR code GS1 standard.",
    requestPilot: "Demander un pilote",
    launchPlatform: "Accéder à la plateforme",
  },
  trust: {
    label: "Conçu pour les chaînes d'approvisionnement industrielles européennes",
    items: [
      { title: "Prêt pour l'ESPR", detail: "Règl. (UE) 2024/1781" },
      { title: "Contenu recyclé PPWR", detail: "Règl. (UE) 2025/40" },
      { title: "Hébergé à Francfort", detail: "Données stockées dans l'UE" },
      { title: "Accès par rôles", detail: "Contrôlé côté serveur" },
      { title: "Infalsifiable", detail: "Scellé par SHA-256" },
    ],
  },
  passport: {
    kicker: "Passeport numérique de produit",
    title: "Compound rPP · Lot RP-2026-0418",
    status: "Émis",
    pcr: "Contenu recyclé post-consommation",
    properties: [
      { label: "Indice de fluidité", detail: "ISO 1133 · 230 °C / 2,16 kg", value: "12,0", unit: "g/10 min" },
      { label: "Masse volumique", detail: "ISO 1183", value: "0,905", unit: "g/cm³" },
      { label: "Empreinte carbone", detail: "Du berceau à la sortie d'usine, PEF", value: "1,42", unit: "kg CO₂e/kg" },
    ],
    checks: [
      "REACH : aucune SVHC au-delà de 0,1 % m/m",
      "Bilan massique ISCC PLUS — vérifié par l'auditeur",
      "Déclaration de contenu recyclé PPWR déposée",
    ],
    sampleNote: "Données d'exemple à titre illustratif",
  },
  features: {
    eyebrow: "Plateforme",
    title: "Conformité, contrôle d'accès et traçabilité dans un seul système.",
    lead: "Remplacez tableurs, PDF et chaînes d'e-mails par un enregistrement unique et vérifié qui accompagne chaque lot.",
    pillars: [
      {
        title: "Conformité ESPR et PPWR",
        summary: "Un passeport structuré par lot, aligné sur les exigences de données du passeport numérique de produit européen.",
        points: [
          "Déclarations de contenu recyclé (PCR/PIR) et PPWR",
          "Déclarations SVHC au titre de REACH avec alertes automatiques",
          "Rapports de conformité et exports (PDF, Excel)",
        ],
      },
      {
        title: "Accès sécurisé par rôles",
        summary: "Chaque rôle voit exactement ce dont il a besoin : administrateurs, auditeurs, clients, fournisseurs et public.",
        points: [
          "Autorisation vérifiée côté serveur à chaque requête",
          "Les clients ne voient que leurs propres lots achetés",
          "Les auditeurs vérifient sans droits d'administration",
        ],
      },
      {
        title: "Traçabilité de la chaîne d'approvisionnement",
        summary: "Suivez la matière de la matière première au compound fini, chaque transfert étant documenté.",
        points: [
          "Enregistrements de chaîne de traçabilité ISCC PLUS, vérifiés par l'auditeur",
          "Généalogie reliant lots parents et lots enfants",
          "Intégration des fournisseurs via des liens sécurisés à usage unique",
        ],
      },
    ],
  },
  compliance: {
    eyebrow: "Conformité",
    title: "Conçu autour des réglementations sur lesquelles vos clients vous interrogent.",
    lead: "Chaque champ du passeport correspond à une exigence : auditeurs et acheteurs obtiennent des réponses plutôt que des pièces jointes.",
    caption: "Réglementations et normes prises en charge par DPP-Polymer",
    columns: { framework: "Cadre", reference: "Référence", coverage: "Ce que DPP-Polymer enregistre" },
    frameworks: [
      {
        name: "ESPR",
        reference: "Règlement (UE) 2024/1781",
        coverage:
          "Passeport structuré par lot avec identifiant unique, support de données QR renvoyant vers un passeport public et statuts de cycle de vie (émis, révoqué, remplacé) sans jamais effacer l'historique.",
      },
      {
        name: "PPWR",
        reference: "Règlement (UE) 2025/40",
        coverage: "Parts de recyclé post-consommation et post-industriel, et déclarations de conformité des emballages par lot.",
      },
      {
        name: "REACH",
        reference: "Règlement (CE) n° 1907/2006",
        coverage: "Déclarations de substances extrêmement préoccupantes (SVHC) au-delà de 0,1 % m/m, avec alertes sur l'ensemble du portefeuille.",
      },
      {
        name: "ISCC PLUS",
        reference: "Chaîne de traçabilité en bilan massique",
        coverage: "Enregistrements de traçabilité et certificats examinés par des auditeurs désignés, avec suivi des échéances.",
      },
      {
        name: "GS1 Digital Link",
        reference: "ISO/IEC 18975",
        coverage: "URI web standardisées par GTIN et par lot, imprimées en étiquettes QR pour les emballages et documents de livraison.",
      },
      {
        name: "Empreinte carbone du produit",
        reference: "Du berceau à la sortie d'usine, kg CO₂e/kg",
        coverage:
          "Empreinte par lot calculée à partir des matières premières et des données de procédé, avec une arithmétique décimale exacte, et enregistrée dans le passeport.",
      },
    ],
    disclaimer:
      "DPP-Polymer accompagne votre documentation de conformité. L'exactitude des déclarations reste de la responsabilité du fabricant ou de l'opérateur économique qui met le produit sur le marché.",
  },
  security: {
    eyebrow: "Sécurité",
    title: "Le moindre privilège pour chaque acteur de la chaîne.",
    lead: "Les données de la chaîne d'approvisionnement sont commercialement sensibles. L'accès est limité par rôle et appliqué côté serveur, pas seulement masqué dans l'interface.",
    rolesHeading: "Rôles",
    integrityHeading: "Intégrité",
    roles: [
      { name: "Administrateur", access: "Crée et gère les passeports, les comptes et les paramètres." },
      { name: "Auditeur", access: "Vérifie les certificats et les enregistrements de traçabilité ; consulte les journaux d'audit." },
      { name: "Client", access: "Ne voit que les lots qu'il a achetés." },
      { name: "Fournisseur", access: "Soumet des données de lot via une invitation à usage unique, pour validation." },
      { name: "Public", access: "Scanne le QR code et consulte uniquement le passeport émis." },
    ],
    guarantees: [
      {
        title: "Refus par défaut",
        body: "Chaque route d'API et chaque action serveur vérifie côté serveur la session ou la clé de l'appelant. Une version qui ajouterait un point d'accès non protégé échoue dès la compilation.",
      },
      {
        title: "Enregistrements infalsifiables",
        body: "Les passeports sont scellés par SHA-256 et chaque modification est consignée dans un journal d'audit chaîné par hachage, vérifiable à tout moment. Les enregistrements sont révoqués ou remplacés, jamais supprimés.",
      },
      {
        title: "Données hébergées dans l'UE",
        body: "Les données des passeports sont stockées dans une base PostgreSQL managée à Francfort (Allemagne) et transmises uniquement via des connexions chiffrées.",
      },
    ],
  },
  pilot: {
    title: "Commencez par un pilote sur votre prochain lot de production.",
    lead: "Nous accompagnons les compoundeurs et les recycleurs dans l'émission de leurs premiers passeports sur de la matière réelle, afin que les données soient prêtes avant que clients et autorités ne les demandent.",
    requestPilot: "Demander un pilote",
    launchPlatform: "Accéder à la plateforme",
    steps: [
      { title: "Cadrer", body: "Choisissez une ligne de produits et les champs de passeport demandés par vos clients." },
      { title: "Intégrer", body: "Importez les données de lots depuis votre ERP ou invitez vos fournisseurs à les saisir." },
      { title: "Émettre", body: "Publiez les passeports, imprimez les étiquettes QR GS1 et ouvrez l'accès aux auditeurs et aux acheteurs." },
    ],
  },
  footer: {
    tagline: "Passeports numériques de produits pour polymères et recyclats.",
    product: "Produit",
    platform: "Plateforme",
    legal: "Informations légales",
    imprint: "Mentions légales",
    privacy: "Confidentialité",
    rights: "Tous droits réservés.",
    closing: "Passeports numériques de produits pour l'industrie européenne des polymères.",
  },
};

export const LANDING_COPY: Record<SiteLocale, LandingCopy> = { en: EN, de: DE, fr: FR };

/** Short labels for the language switch. */
export const LOCALE_LABELS: Record<SiteLocale, { short: string; name: string }> = {
  en: { short: "EN", name: "English" },
  de: { short: "DE", name: "Deutsch" },
  fr: { short: "FR", name: "Français" },
};
