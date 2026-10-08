/**
 * lib/site-config.ts
 * -----------------------------------------------------------------------
 * Single source of truth for the public corporate website (app/page.tsx,
 * app/imprint, app/privacy and components/landing/*): brand name, routes
 * into the platform, the pilot-request contact, and the legal entity
 * details shown in the Imprint (Impressum).
 *
 * The platform itself lives under /app (Material Ledger console) and the
 * existing /admin, /portal/*, /auditor and /client-portal routes. A Vercel
 * domain such as app.dpp-polymer.de can point at the same deployment:
 * middleware.ts rewrites "/" on any "app." host to /app.
 *
 * Legal details: an Impressum is mandatory for a commercial website in
 * Germany (§ 5 DDG). Fill in LEGAL_ENTITY below before the site goes live.
 * Empty fields are not rendered, so nothing invented is ever published.
 */

export const SITE = {
  name: "DPP-Polymer",
  tagline: "Digital Product Passports for polymers and recyclates",
  description:
    "EU-compliant Digital Product Passports for the polymer and plastics industry: ESPR and PPWR data, REACH SVHC declarations, ISCC PLUS chain of custody and GS1 Digital Link QR codes, secured by role-based access control.",
} as const;

export const ROUTES = {
  platform: "/app",
  login: "/login",
  imprint: "/imprint",
  privacy: "/privacy",
} as const;

/**
 * Pilot requests go to this mailbox. Set NEXT_PUBLIC_PILOT_CONTACT_EMAIL in
 * Vercel (Project → Settings → Environment Variables) to change it without
 * a code edit.
 */
export const PILOT_CONTACT_EMAIL = process.env.NEXT_PUBLIC_PILOT_CONTACT_EMAIL?.trim() || "pilot@dpp-polymer.de";

export function pilotMailto(): string {
  const subject = encodeURIComponent("Pilot request – DPP-Polymer");
  const body = encodeURIComponent(
    "Company:\nContact person:\nMaterials / polymer types:\nApprox. batches per month:\nTarget start date:\n"
  );
  return `mailto:${PILOT_CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}

export interface LegalEntity {
  /** Registered company or sole-trader name, e.g. "DPP-Polymer GmbH". */
  companyName: string;
  /** Person(s) authorised to represent the company. */
  representative: string;
  street: string;
  postalCodeAndCity: string;
  country: string;
  email: string;
  phone: string;
  /** Commercial register court and number, e.g. "Amtsgericht Aachen, HRB 12345". */
  commercialRegister: string;
  /** VAT identification number (USt-IdNr.) under § 27a UStG. */
  vatId: string;
  /** Person responsible for editorial content (§ 18 Abs. 2 MStV). */
  contentResponsible: string;
}

export const LEGAL_ENTITY: LegalEntity = {
  companyName: "DPP-Polymer",
  representative: "Reza Hashemi Farzad",
  street: "",
  postalCodeAndCity: "",
  country: "Germany",
  email: PILOT_CONTACT_EMAIL,
  phone: "",
  commercialRegister: "",
  vatId: "",
  contentResponsible: "Reza Hashemi Farzad",
};
