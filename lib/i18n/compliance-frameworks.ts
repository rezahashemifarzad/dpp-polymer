/**
 * lib/i18n/compliance-frameworks.ts
 * -----------------------------------------------------------------------
 * Content for the landing page's Compliance section (#compliance) in
 * English, German and French. Rendered by
 * components/landing/compliance-section.tsx.
 *
 * Every framework shows:
 *   acronym       short form, e.g. "PPWR"
 *   fullName      the full official term
 *   reference     legal act or standard number
 *   status        where it stands today (dated fact — see review note)
 *   whatItIs      plain-language definition, one or two sentences
 *   howWeSupport  what DPP-Polymer actually records for it
 *
 * Drift protection — the build fails (type error) if:
 *   - a language is missing (Record<SiteLocale, …>);
 *   - a language is missing one of the nine frameworks or has an unknown
 *     one (Record<ComplianceFrameworkId, …>);
 *   - any framework is missing a field;
 *   - a framework is not assigned to a topic group (FRAMEWORK_GROUP).
 *
 * Wording rules (sales copy for regulated buyers):
 *   - "supports" / "records", never "certifies" or "makes you compliant":
 *     the economic operator stays responsible for its declarations;
 *   - howWeSupport only describes capabilities that exist in the product;
 *   - status lines are dated facts. Review them whenever a delegated or
 *     implementing act is published. Last reviewed: 14 October 2026.
 */

import type { SiteLocale } from "@/lib/site-config";

export type ComplianceFrameworkId =
  | "espr"
  | "gs1DigitalLink"
  | "ppwr"
  | "supd"
  | "svhc"
  | "scip"
  | "isccPlus"
  | "pcf"
  | "ecgt";

export type ComplianceGroupId = "passport" | "packaging" | "substances" | "traceability" | "claims";

export interface ComplianceFramework {
  acronym: string;
  fullName: string;
  reference: string;
  status: string;
  whatItIs: string;
  howWeSupport: string;
}

export interface ComplianceContent {
  /** Topic card headings. */
  groups: Record<ComplianceGroupId, string>;
  /** Field labels shown (or announced to screen readers) on every row. */
  labels: { reference: string; status: string; whatItIs: string; howWeSupport: string };
  frameworks: Record<ComplianceFrameworkId, ComplianceFramework>;
}

/** Display order of the topic cards. */
export const COMPLIANCE_GROUP_ORDER: readonly ComplianceGroupId[] = [
  "passport",
  "packaging",
  "substances",
  "traceability",
  "claims",
];

/**
 * Topic card of every framework, in display order. A Record, so adding a
 * framework id without placing it in a card is a compile error.
 */
export const FRAMEWORK_GROUP: Record<ComplianceFrameworkId, ComplianceGroupId> = {
  espr: "passport",
  gs1DigitalLink: "passport",
  ppwr: "packaging",
  supd: "packaging",
  svhc: "substances",
  scip: "substances",
  isccPlus: "traceability",
  pcf: "traceability",
  ecgt: "claims",
};

/** Framework ids of one topic card, in display order. */
export function frameworksInGroup(group: ComplianceGroupId): ComplianceFrameworkId[] {
  return (Object.keys(FRAMEWORK_GROUP) as ComplianceFrameworkId[]).filter((id) => FRAMEWORK_GROUP[id] === group);
}

const EN: ComplianceContent = {
  groups: {
    passport: "Product passport",
    packaging: "Packaging",
    substances: "Substances",
    traceability: "Traceability",
    claims: "Claims",
  },
  labels: {
    reference: "Legal reference",
    status: "Status",
    whatItIs: "What it is",
    howWeSupport: "How DPP-Polymer supports it",
  },
  frameworks: {
    espr: {
      acronym: "ESPR",
      fullName: "Ecodesign for Sustainable Products Regulation",
      reference: "Regulation (EU) 2024/1781",
      status: "In force since July 2024 · EU DPP Registry live since July 2026",
      whatItIs:
        "The EU framework that introduces the Digital Product Passport. Product-specific delegated acts define which data each product group must disclose — such as recycled content, substances of concern and environmental footprint — through a unique identifier and a data carrier on the product.",
      howWeSupport:
        "One structured passport per batch with a unique identifier, a QR data carrier that resolves to a public passport, and lifecycle states (issued, revoked, superseded) that never delete history.",
    },
    gs1DigitalLink: {
      acronym: "GS1 Digital Link",
      fullName: "GS1 Digital Link URI syntax",
      reference: "ISO/IEC 18975",
      status: "International standard",
      whatItIs:
        "Encodes a product's GTIN and batch number in a standard web address, so a single QR code serves logistics, retail scanning and the public product passport.",
      howWeSupport: "Standard URIs per GTIN and batch, printed as QR labels for packaging and delivery documents.",
    },
    ppwr: {
      acronym: "PPWR",
      fullName: "Packaging and Packaging Waste Regulation",
      reference: "Regulation (EU) 2025/40",
      status: "Applies since 12 August 2026",
      whatItIs:
        "Replaces the Packaging Directive with directly binding rules: packaging must be recyclable, plastic packaging must meet minimum recycled-content shares (from 2030 at the earliest), and producers must document conformity.",
      howWeSupport:
        "Post-consumer and post-industrial recycled-content shares, recyclability grade and a conformity declaration for each packaging-grade batch.",
    },
    supd: {
      acronym: "SUPD",
      fullName: "Single-Use Plastics Directive",
      reference: "Directive (EU) 2019/904",
      status: "Recycled content: 25 % in PET bottles from 2025, 30 % in all plastic beverage bottles from 2030",
      whatItIs:
        "Restricts selected single-use plastic products and sets binding minimum shares of recycled plastic in beverage bottles.",
      howWeSupport:
        "Verified post-consumer recycled share per batch — the evidence bottle producers need from their resin suppliers.",
    },
    svhc: {
      acronym: "SVHC",
      fullName: "Substances of Very High Concern (REACH)",
      reference: "Regulation (EC) No 1907/2006",
      status: "In force · ECHA Candidate List updated twice a year",
      whatItIs:
        "Chemicals on ECHA's Candidate List, such as certain plasticisers and flame retardants. If an article contains one above 0.1 % w/w, suppliers must inform their customers (Art. 33) and must answer consumer requests within 45 days.",
      howWeSupport: "An SVHC declaration on every batch, with portfolio-wide alerts for missing or flagged declarations.",
    },
    scip: {
      acronym: "SCIP",
      fullName: "Substances of Concern In articles as such or in complex objects (Products)",
      reference: "Directive 2008/98/EC (Waste Framework Directive), Art. 9",
      status: "Notification duty since January 2021",
      whatItIs:
        "ECHA database in which companies placing articles on the EU market notify SVHCs above 0.1 % w/w, so that recyclers know what a material contains.",
      howWeSupport: "Batch-level SVHC data held in one place, ready for preparing your SCIP notifications.",
    },
    isccPlus: {
      acronym: "ISCC PLUS",
      fullName: "International Sustainability & Carbon Certification PLUS",
      reference: "Voluntary certification scheme",
      status: "Mass-balance chain of custody",
      whatItIs:
        "A widely used certification for recycled and bio-based materials. Its mass-balance model tracks certified content through mixed production and allocates it to output batches.",
      howWeSupport: "Chain-of-custody records and certificates reviewed by named auditors, with expiry monitoring.",
    },
    pcf: {
      acronym: "PCF",
      fullName: "Product Carbon Footprint",
      reference: "ISO 14067 · EU Product Environmental Footprint (PEF) method",
      status: "Methodology standards",
      whatItIs:
        "The greenhouse-gas emissions of a product in kg CO₂-equivalent per kg. Cradle-to-gate covers everything from raw-material extraction to the factory gate.",
      howWeSupport:
        "A cradle-to-gate footprint per batch, calculated with exact decimal arithmetic and stored with the passport.",
    },
    ecgt: {
      acronym: "ECGT",
      fullName: "Empowering Consumers for the Green Transition Directive",
      reference: "Directive (EU) 2024/825",
      status: "Applies from 27 September 2026",
      whatItIs:
        "Bans generic environmental claims such as “eco-friendly” or “climate-neutral” unless they are backed by recognised, verifiable evidence.",
      howWeSupport: "Verified, batch-level data behind your recycled-content and carbon-footprint claims.",
    },
  },
};

const DE: ComplianceContent = {
  groups: {
    passport: "Produktpass",
    packaging: "Verpackung",
    substances: "Stoffe",
    traceability: "Rückverfolgbarkeit",
    claims: "Umweltaussagen",
  },
  labels: {
    reference: "Rechtsgrundlage",
    status: "Status",
    whatItIs: "Worum es geht",
    howWeSupport: "So unterstützt DPP-Polymer",
  },
  frameworks: {
    espr: {
      acronym: "ESPR",
      fullName: "Ökodesign-Verordnung für nachhaltige Produkte",
      reference: "Verordnung (EU) 2024/1781",
      status: "In Kraft seit Juli 2024 · EU-DPP-Register in Betrieb seit Juli 2026",
      whatItIs:
        "Der EU-Rahmen, der den Digitalen Produktpass einführt. Produktspezifische delegierte Rechtsakte legen fest, welche Daten eine Produktgruppe offenlegen muss – etwa Rezyklatanteil, besorgniserregende Stoffe und Umweltfußabdruck – über eine eindeutige Kennung und einen Datenträger am Produkt.",
      howWeSupport:
        "Ein strukturierter Produktpass pro Charge mit eindeutiger Kennung, QR-Datenträger mit Verweis auf den öffentlichen Pass und Lebenszyklusstatus (ausgestellt, widerrufen, ersetzt), ohne die Historie zu löschen.",
    },
    gs1DigitalLink: {
      acronym: "GS1 Digital Link",
      fullName: "GS1-Digital-Link-URI-Syntax",
      reference: "ISO/IEC 18975",
      status: "Internationaler Standard",
      whatItIs:
        "Kodiert GTIN und Chargennummer eines Produkts in einer standardisierten Webadresse – ein einziger QR-Code dient so Logistik, Handel und dem öffentlichen Produktpass.",
      howWeSupport: "Standardisierte URIs pro GTIN und Charge, gedruckt als QR-Etiketten für Verpackungen und Lieferpapiere.",
    },
    ppwr: {
      acronym: "PPWR",
      fullName: "Verpackungs- und Verpackungsabfallverordnung",
      reference: "Verordnung (EU) 2025/40",
      status: "Gilt seit dem 12. August 2026",
      whatItIs:
        "Ersetzt die Verpackungsrichtlinie durch unmittelbar geltende Regeln: Verpackungen müssen recyclingfähig sein, Kunststoffverpackungen müssen Mindest-Rezyklatanteile erreichen (frühestens ab 2030), und Hersteller müssen die Konformität dokumentieren.",
      howWeSupport:
        "Anteile an Post-Consumer- und Post-Industrial-Rezyklat, Recyclingfähigkeitsklasse und eine Konformitätserklärung für jede Verpackungscharge.",
    },
    supd: {
      acronym: "SUPD",
      fullName: "Einwegkunststoffrichtlinie",
      reference: "Richtlinie (EU) 2019/904",
      status: "Rezyklatanteil: 25 % in PET-Flaschen ab 2025, 30 % in allen Kunststoff-Getränkeflaschen ab 2030",
      whatItIs:
        "Beschränkt ausgewählte Einwegkunststoffprodukte und legt verbindliche Mindestanteile an recyceltem Kunststoff in Getränkeflaschen fest.",
      howWeSupport:
        "Verifizierter Post-Consumer-Rezyklatanteil pro Charge – der Nachweis, den Flaschenhersteller von ihren Granulatlieferanten benötigen.",
    },
    svhc: {
      acronym: "SVHC",
      fullName: "Besonders besorgniserregende Stoffe (REACH)",
      reference: "Verordnung (EG) Nr. 1907/2006",
      status: "In Kraft · ECHA-Kandidatenliste wird zweimal jährlich aktualisiert",
      whatItIs:
        "Stoffe auf der Kandidatenliste der ECHA, etwa bestimmte Weichmacher und Flammschutzmittel. Enthält ein Erzeugnis einen solchen Stoff über 0,1 % (w/w), müssen Lieferanten ihre Abnehmer informieren (Art. 33) und Verbraucheranfragen innerhalb von 45 Tagen beantworten.",
      howWeSupport: "Eine SVHC-Erklärung für jede Charge, mit portfolioweiten Warnungen bei fehlenden oder auffälligen Erklärungen.",
    },
    scip: {
      acronym: "SCIP",
      fullName: "Besorgniserregende Stoffe in Erzeugnissen als solchen oder in komplexen Gegenständen (Produkten)",
      reference: "Richtlinie 2008/98/EG (Abfallrahmenrichtlinie), Art. 9",
      status: "Meldepflicht seit Januar 2021",
      whatItIs:
        "ECHA-Datenbank, in der Unternehmen, die Erzeugnisse in der EU in Verkehr bringen, SVHC über 0,1 % (w/w) melden – damit Recycler wissen, was ein Material enthält.",
      howWeSupport: "Chargenbezogene SVHC-Daten an einem Ort, bereit für die Vorbereitung Ihrer SCIP-Meldungen.",
    },
    isccPlus: {
      acronym: "ISCC PLUS",
      fullName: "International Sustainability & Carbon Certification PLUS",
      reference: "Freiwilliges Zertifizierungssystem",
      status: "Massenbilanz-Lieferkette",
      whatItIs:
        "Eine verbreitete Zertifizierung für recycelte und biobasierte Materialien. Das Massenbilanzmodell verfolgt zertifizierte Anteile durch gemischte Produktion und ordnet sie Ausgangschargen zu.",
      howWeSupport: "Lieferkettennachweise und Zertifikate, geprüft durch benannte Prüfer, mit Überwachung der Gültigkeit.",
    },
    pcf: {
      acronym: "PCF",
      fullName: "Produkt-CO₂-Fußabdruck",
      reference: "ISO 14067 · EU-Methode Product Environmental Footprint (PEF)",
      status: "Methodenstandards",
      whatItIs:
        "Die Treibhausgasemissionen eines Produkts in kg CO₂-Äquivalent pro kg. Cradle-to-Gate umfasst alles von der Rohstoffgewinnung bis zum Werkstor.",
      howWeSupport: "Ein Cradle-to-Gate-Fußabdruck pro Charge, mit exakter Dezimalarithmetik berechnet und im Pass gespeichert.",
    },
    ecgt: {
      acronym: "ECGT",
      fullName: "Richtlinie zur Stärkung der Verbraucher für den ökologischen Wandel",
      reference: "Richtlinie (EU) 2024/825",
      status: "Gilt ab dem 27. September 2026",
      whatItIs:
        "Verbietet allgemeine Umweltaussagen wie „umweltfreundlich“ oder „klimaneutral“, sofern sie nicht durch anerkannte, überprüfbare Nachweise belegt sind.",
      howWeSupport: "Verifizierte, chargenbezogene Daten als Grundlage Ihrer Aussagen zu Rezyklatanteil und CO₂-Fußabdruck.",
    },
  },
};

const FR: ComplianceContent = {
  groups: {
    passport: "Passeport produit",
    packaging: "Emballages",
    substances: "Substances",
    traceability: "Traçabilité",
    claims: "Allégations",
  },
  labels: {
    reference: "Référence juridique",
    status: "Statut",
    whatItIs: "De quoi s'agit-il",
    howWeSupport: "Comment DPP-Polymer vous accompagne",
  },
  frameworks: {
    espr: {
      acronym: "ESPR",
      fullName: "Règlement sur l'écoconception des produits durables",
      reference: "Règlement (UE) 2024/1781",
      status: "En vigueur depuis juillet 2024 · registre européen des DPP opérationnel depuis juillet 2026",
      whatItIs:
        "Le cadre européen qui instaure le passeport numérique de produit. Des actes délégués par groupe de produits fixent les données à publier – contenu recyclé, substances préoccupantes, empreinte environnementale, etc. – via un identifiant unique et un support de données sur le produit.",
      howWeSupport:
        "Un passeport structuré par lot avec identifiant unique, support de données QR renvoyant vers un passeport public et statuts de cycle de vie (émis, révoqué, remplacé) sans jamais effacer l'historique.",
    },
    gs1DigitalLink: {
      acronym: "GS1 Digital Link",
      fullName: "Syntaxe d'URI GS1 Digital Link",
      reference: "ISO/IEC 18975",
      status: "Norme internationale",
      whatItIs:
        "Encode le GTIN et le numéro de lot d'un produit dans une adresse web standardisée : un seul QR code sert à la logistique, au commerce et au passeport produit public.",
      howWeSupport: "URI standardisées par GTIN et par lot, imprimées en étiquettes QR pour les emballages et documents de livraison.",
    },
    ppwr: {
      acronym: "PPWR",
      fullName: "Règlement relatif aux emballages et aux déchets d'emballages",
      reference: "Règlement (UE) 2025/40",
      status: "Applicable depuis le 12 août 2026",
      whatItIs:
        "Remplace la directive Emballages par des règles directement applicables : les emballages doivent être recyclables, les emballages plastiques doivent atteindre des taux minimaux de contenu recyclé (au plus tôt en 2030) et les producteurs doivent documenter leur conformité.",
      howWeSupport:
        "Parts de recyclé post-consommation et post-industriel, classe de recyclabilité et déclaration de conformité pour chaque lot destiné à l'emballage.",
    },
    supd: {
      acronym: "SUPD",
      fullName: "Directive sur les plastiques à usage unique",
      reference: "Directive (UE) 2019/904",
      status: "Contenu recyclé : 25 % dans les bouteilles PET dès 2025, 30 % dans toutes les bouteilles plastiques pour boissons dès 2030",
      whatItIs:
        "Restreint certains produits en plastique à usage unique et fixe des taux minimaux obligatoires de plastique recyclé dans les bouteilles pour boissons.",
      howWeSupport:
        "Part de recyclé post-consommation vérifiée par lot – la preuve que les fabricants de bouteilles attendent de leurs fournisseurs de résine.",
    },
    svhc: {
      acronym: "SVHC",
      fullName: "Substances extrêmement préoccupantes (REACH)",
      reference: "Règlement (CE) n° 1907/2006",
      status: "En vigueur · liste candidate de l'ECHA mise à jour deux fois par an",
      whatItIs:
        "Substances inscrites sur la liste candidate de l'ECHA, comme certains plastifiants et retardateurs de flamme. Si un article en contient plus de 0,1 % m/m, le fournisseur doit en informer ses clients (art. 33) et répondre aux demandes des consommateurs sous 45 jours.",
      howWeSupport:
        "Une déclaration SVHC pour chaque lot, avec des alertes sur l'ensemble du portefeuille en cas de déclaration manquante ou signalée.",
    },
    scip: {
      acronym: "SCIP",
      fullName: "Substances préoccupantes dans les articles en tant que tels ou dans des objets complexes (produits)",
      reference: "Directive 2008/98/CE (directive-cadre relative aux déchets), art. 9",
      status: "Obligation de notification depuis janvier 2021",
      whatItIs:
        "Base de données de l'ECHA dans laquelle les entreprises qui mettent des articles sur le marché européen notifient les SVHC au-delà de 0,1 % m/m, afin que les recycleurs sachent ce que contient une matière.",
      howWeSupport: "Des données SVHC par lot réunies en un seul endroit, prêtes pour la préparation de vos notifications SCIP.",
    },
    isccPlus: {
      acronym: "ISCC PLUS",
      fullName: "International Sustainability & Carbon Certification PLUS",
      reference: "Système de certification volontaire",
      status: "Chaîne de traçabilité en bilan massique",
      whatItIs:
        "Une certification largement utilisée pour les matières recyclées et biosourcées. Son modèle de bilan massique suit le contenu certifié dans une production mixte et l'attribue aux lots sortants.",
      howWeSupport: "Enregistrements de traçabilité et certificats examinés par des auditeurs désignés, avec suivi des échéances.",
    },
    pcf: {
      acronym: "PCF",
      fullName: "Empreinte carbone du produit",
      reference: "ISO 14067 · méthode européenne Product Environmental Footprint (PEF)",
      status: "Normes méthodologiques",
      whatItIs:
        "Les émissions de gaz à effet de serre d'un produit en kg d'équivalent CO₂ par kg. Le périmètre « du berceau à la sortie d'usine » va de l'extraction des matières premières jusqu'à la porte de l'usine.",
      howWeSupport:
        "Une empreinte du berceau à la sortie d'usine par lot, calculée avec une arithmétique décimale exacte et enregistrée dans le passeport.",
    },
    ecgt: {
      acronym: "ECGT",
      fullName: "Directive « donner aux consommateurs les moyens d'agir en faveur de la transition verte »",
      reference: "Directive (UE) 2024/825",
      status: "Applicable à partir du 27 septembre 2026",
      whatItIs:
        "Interdit les allégations environnementales génériques comme « écologique » ou « neutre en carbone » si elles ne reposent pas sur des preuves reconnues et vérifiables.",
      howWeSupport: "Des données vérifiées par lot pour étayer vos allégations sur le contenu recyclé et l'empreinte carbone.",
    },
  },
};

/** All Compliance section content, per site language. */
export const complianceFrameworks: Record<SiteLocale, ComplianceContent> = { en: EN, de: DE, fr: FR };
