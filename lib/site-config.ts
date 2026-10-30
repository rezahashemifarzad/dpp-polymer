/**
 * lib/site-config.ts
 * -----------------------------------------------------------------------
 * Single source of truth for the public corporate website (app/page.tsx,
 * app/de/*, app/imprint, app/privacy and components/landing/*): brand name,
 * per-language routes, routes into the platform, the pilot-request contact,
 * and the legal entity details shown in the Imprint (Impressum).
 *
 * Languages: English lives at "/", German at "/de", French at "/fr". Both are prerendered
 * static pages, so each language is indexable on its own URL (hreflang
 * alternates are declared in each page's metadata).
 *
 * The platform itself lives under /app (Material Ledger console) and the
 * existing /admin, /portal/*, /auditor and /client-portal routes. A Vercel
 * domain such as app.dpp-polymer.de can point at the same deployment:
 * proxy.ts rewrites "/" on any "app." host to /app.
 *
 * Legal details: an Impressum is mandatory for a commercial website in
 * Germany (§ 5 DDG). LEGAL_ENTITY below feeds the Imprint, the privacy
 * notice's controller block and the footer copyright. Empty fields are not
 * rendered, so nothing invented is ever published.
 *
 * Brand vs. legal name: SITE.name ("DPP-Polymer") is the brand used in the
 * logo, headers and page titles. LEGAL_ENTITY.companyName carries the legal
 * status ("DPP-Polymer (in Gründung)") and appears only on the legal pages
 * and in the footer copyright line.
 */

export type SiteLocale = "en" | "de" | "fr";

export const SITE_LOCALES: readonly SiteLocale[] = ["en", "de", "fr"];

export const SITE = {
  name: "DPP-Polymer",
  /** Official production domain (apex is canonical; www redirects to it in Vercel). */
  domain: "dpp-polymer.de",
  productionUrl: "https://dpp-polymer.de",
} as const;

/** Routes into the platform — identical in both languages. */
export const ROUTES = {
  platform: "/app",
  login: "/login",
} as const;

/** Public corporate-site routes per language. */
export const LOCALE_ROUTES: Record<SiteLocale, { home: string; imprint: string; privacy: string }> = {
  en: { home: "/", imprint: "/imprint", privacy: "/privacy" },
  de: { home: "/de", imprint: "/de/impressum", privacy: "/de/datenschutz" },
  fr: { home: "/fr", imprint: "/fr/mentions-legales", privacy: "/fr/confidentialite" },
};

/** Every path that renders the corporate-site chrome (used to hide the platform nav). */
export const CORPORATE_SITE_PATHS: readonly string[] = SITE_LOCALES.flatMap((l) => Object.values(LOCALE_ROUTES[l]));

/** Corporate-site home for a platform language (used by the app's "Main site" link). */
export function homeForAppLanguage(lang: "EN" | "DE" | "FR"): string {
  return LOCALE_ROUTES[lang === "DE" ? "de" : lang === "FR" ? "fr" : "en"].home;
}

/** Anchor link to a section of the landing page in the given language. */
export function sectionHref(locale: SiteLocale, section: "features" | "compliance" | "security" | "pilot" | "contact"): string {
  return `${LOCALE_ROUTES[locale].home}#${section}`;
}

/**
 * Absolute base URL for metadata (canonical + hreflang). next.config.ts
 * resolves NEXT_PUBLIC_BASE_URL at build time (explicit value, else
 * https://dpp-polymer.de on Vercel production, else the deployment URL,
 * else localhost).
 */
export function siteUrl(): URL {
  return new URL(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000");
}

/**
 * Official contact mailbox for all platform inquiries (pilot requests,
 * Imprint, privacy contact, footer, and the sender / reply-to of
 * transactional email — see lib/services/email-dispatch.ts). Set
 * NEXT_PUBLIC_CONTACT_EMAIL in Vercel (Project → Settings → Environment
 * Variables) to change it without a code edit.
 */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "info@dpp-polymer.de";

/** Plain mail link to the official contact mailbox (general inquiries). */
export function contactMailto(): string {
  return `mailto:${CONTACT_EMAIL}`;
}

/** Pilot requests go to the official contact mailbox. */
export const PILOT_CONTACT_EMAIL = CONTACT_EMAIL;

const PILOT_MAIL: Record<SiteLocale, { subject: string; body: string }> = {
  en: {
    subject: "Pilot request – DPP-Polymer",
    body: "Company:\nContact person:\nMaterials / polymer types:\nApprox. batches per month:\nTarget start date:\n",
  },
  de: {
    subject: "Pilotanfrage – DPP-Polymer",
    body: "Unternehmen:\nAnsprechpartner:\nMaterialien / Polymertypen:\nChargen pro Monat (ca.):\nGewünschter Start:\n",
  },
  fr: {
    subject: "Demande de projet pilote – DPP-Polymer",
    body: "Entreprise :\nInterlocuteur :\nMatériaux / types de polymères :\nLots par mois (env.) :\nDate de démarrage souhaitée :\n",
  },
};

export function pilotMailto(locale: SiteLocale = "en"): string {
  const { subject, body } = PILOT_MAIL[locale];
  return `mailto:${PILOT_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export interface LegalEntity {
  /**
   * Legal name as shown on the legal pages. Before incorporation this is the
   * project name with "(in Gründung)"; after registration, the registered
   * name, e.g. "DPP-Polymer GmbH".
   */
  companyName: string;
  /**
   * Pre-incorporation flag. While true, the provider under § 5 DDG is the
   * founder personally (named in `representative`): the Imprint names the
   * founder first, labels them "Founder" rather than "Represented by", and
   * shows `legalStatus`. Set to false once the company is registered, and
   * fill in commercialRegister / vatId.
   */
  inFormation: boolean;
  /** Founder (while inFormation) or the person(s) authorised to represent the company. */
  representative: string;
  street: string;
  postalCodeAndCity: string;
  /** Country name per language. */
  country: Record<SiteLocale, string>;
  email: string;
  phone: string;
  /** Commercial register court and number, e.g. "Amtsgericht Aachen, HRB 12345". */
  commercialRegister: string;
  /** VAT identification number (USt-IdNr.) under § 27a UStG. */
  vatId: string;
  /** Person responsible for editorial content (§ 18 Abs. 2 MStV). */
  contentResponsible: string;
  /** Legal status note per language, shown on the Imprint while inFormation is true. */
  legalStatus: Record<SiteLocale, string>;
}

export const LEGAL_ENTITY: LegalEntity = {
  companyName: "DPP-Polymer (in Gründung)",
  inFormation: true,
  representative: "Reza Hashemi Farzad",
  street: "Schenkendorfstraße 2-6",
  postalCodeAndCity: "52066 Aachen",
  country: { en: "Germany", de: "Deutschland", fr: "Allemagne" },
  email: CONTACT_EMAIL,
  phone: "",
  commercialRegister: "",
  vatId: "",
  contentResponsible: "Reza Hashemi Farzad",
  legalStatus: {
    en:
      "DPP-Polymer is currently in the pre-incorporation phase (in Gründung). The project is run by its founder, Reza Hashemi Farzad; no company has been entered in the commercial register yet, and no VAT identification number has been issued. Until incorporation, the provider of this website within the meaning of § 5 DDG is the founder named above. This notice will be updated with the register details as soon as the company is registered.",
    de:
      "DPP-Polymer befindet sich derzeit in Gründung. Das Vorhaben wird von seinem Gründer, Reza Hashemi Farzad, betrieben; eine Eintragung in das Handelsregister ist noch nicht erfolgt, eine Umsatzsteuer-Identifikationsnummer wurde noch nicht erteilt. Bis zur Gründung ist Diensteanbieter dieser Website im Sinne des § 5 DDG der oben genannte Gründer. Die Registerangaben werden ergänzt, sobald die Gesellschaft eingetragen ist.",
    fr:
      "DPP-Polymer est actuellement en cours de création (in Gründung). Le projet est porté par son fondateur, Reza Hashemi Farzad ; aucune société n'est encore immatriculée au registre du commerce et aucun numéro de TVA intracommunautaire n'a encore été attribué. Jusqu'à la constitution de la société, le prestataire de ce site au sens du § 5 DDG est le fondateur nommé ci-dessus. Ces mentions seront complétées par les informations d'immatriculation dès l'enregistrement de la société.",
  },
};
