/**
 * lib/i18n/app-dictionary.ts
 * -----------------------------------------------------------------------
 * Bug fix — "the language switcher changes the dropdown state but doesn't
 * actually translate admin/internal page text." lib/hooks/use-language.tsx
 * previously only held the selected language; nothing consumed it to
 * change rendered text outside app/page.tsx's own local `translations`
 * object. This is the admin/internal-chrome equivalent: a flat
 * EN/DE/FR dictionary (same shape as lib/i18n/dictionaries.ts, the
 * already-working public-scan-page system — deliberately NOT merged with
 * it, since that one is locale-JSON-per-file and scoped to a completely
 * different page's content) covering SiteNav's nav labels and every
 * admin page's title/subtitle header — the text visible immediately on
 * every admin/internal page, translated via lib/hooks/use-language.tsx's
 * `t(key)`.
 *
 * Scope, stated plainly: this covers global nav + every admin page's own
 * header (title + one-line description) — the text a user sees the
 * instant they land on any admin page, which is what actually proves the
 * switch works. It does NOT translate every table column, button label,
 * or dynamic data value inside each dashboard's body — that's hundreds of
 * additional strings across 8+ large components, real future work, not
 * something silently left half-done and passed off as complete.
 */

import type { AppLanguage } from "@/lib/hooks/use-language";

export type AppDictionary = Record<string, string>;

const EN: AppDictionary = {
  "nav.home": "Home",
  "nav.admin": "Admin Console",
  "nav.esg": "ESG Analytics",
  "nav.auditor": "Auditor Portal",
  "nav.client": "Client Portal",
  "nav.signin": "Sign In",

  "admin.title": "DPP Industrial Admin Console",
  "admin.subtitle": "Compounder & Material Lifecycle Management (ESPR Compliance)",
  "admin.ledgerTitle": "Material Ledger & Active Passports",

  "accounts.title": "Access Control — Auditor & Buyer Accounts",
  "accounts.subtitle":
    "Provision, deactivate, and manage credentials for Auditor and Client (buyer) accounts — the same capability as scripts/create-auditor.ts / scripts/create-client.ts and their companion password/rotation scripts, from the admin console instead of a terminal.",

  "suppliers.title": "Supplier Performance & Compliance Ranking",
  "suppliers.subtitle": "Comparative scorecards across every linked supplier",

  "notifications.title": "Notifications & Webhooks",
  "notifications.subtitle": "Automated compliance alerts, email notifications, and outbound webhook integrations",

  "audit.title": "Audit Log & Compliance Ledger",
  "audit.subtitle": "Immutable, hash-chained record of every platform action",

  "esg.title": "Corporate ESG Analytics",
  "esg.subtitle": "Sustainability & Circular Economy Summary",

  "greenAccounting.title": "Green Accounting & Plastic Tax",
  "greenAccounting.subtitle": "EU Plastic Packaging Tax Tracker",

  "generator.title": "Batch Certificate & QR Generator Suite",
  "generator.subtitle": "Preview, customize, and print compliance certificates and factory label sheets",

  "search.title": "Global Search & Filtering",
  "search.subtitle": "Batches · Certificates · Suppliers · Audit Log — all at once",
};

const DE: AppDictionary = {
  "nav.home": "Startseite",
  "nav.admin": "Admin-Konsole",
  "nav.esg": "ESG-Analyse",
  "nav.auditor": "Prüferportal",
  "nav.client": "Kundenportal",
  "nav.signin": "Anmelden",

  "admin.title": "DPP Industrie-Admin-Konsole",
  "admin.subtitle": "Compoundier- und Materiallebenszyklus-Management (ESPR-Konformität)",
  "admin.ledgerTitle": "Materialregister & aktive Produktpässe",

  "accounts.title": "Zugriffskontrolle — Prüfer- und Käuferkonten",
  "accounts.subtitle":
    "Zugangsdaten für Prüfer- und Kundenkonten (Käufer) anlegen, deaktivieren und verwalten — dieselbe Funktion wie scripts/create-auditor.ts / scripts/create-client.ts und die zugehörigen Passwort-/Rotationsskripte, jedoch direkt aus der Admin-Konsole statt über ein Terminal.",

  "suppliers.title": "Lieferantenleistung & Compliance-Ranking",
  "suppliers.subtitle": "Vergleichende Kennzahlen für alle verknüpften Lieferanten",

  "notifications.title": "Benachrichtigungen & Webhooks",
  "notifications.subtitle": "Automatisierte Compliance-Warnungen, E-Mail-Benachrichtigungen und ausgehende Webhook-Integrationen",

  "audit.title": "Prüfprotokoll & Compliance-Register",
  "audit.subtitle": "Unveränderliches, hash-verkettetes Protokoll jeder Plattformaktion",

  "esg.title": "Unternehmensweite ESG-Analyse",
  "esg.subtitle": "Zusammenfassung Nachhaltigkeit & Kreislaufwirtschaft",

  "greenAccounting.title": "Green Accounting & Plastiksteuer",
  "greenAccounting.subtitle": "EU-Plastikverpackungssteuer-Tracker",

  "generator.title": "Chargenzertifikat- & QR-Generator-Suite",
  "generator.subtitle": "Compliance-Zertifikate und Werksetiketten in der Vorschau anzeigen, anpassen und drucken",

  "search.title": "Globale Suche & Filterung",
  "search.subtitle": "Chargen · Zertifikate · Lieferanten · Prüfprotokoll — alles auf einen Blick",
};

const FR: AppDictionary = {
  "nav.home": "Accueil",
  "nav.admin": "Console d'administration",
  "nav.esg": "Analyse ESG",
  "nav.auditor": "Portail auditeur",
  "nav.client": "Portail client",
  "nav.signin": "Connexion",

  "admin.title": "Console d'administration industrielle DPP",
  "admin.subtitle": "Gestion du compoundage et du cycle de vie des matériaux (conformité ESPR)",
  "admin.ledgerTitle": "Registre des matériaux et passeports actifs",

  "accounts.title": "Contrôle d'accès — comptes auditeurs et acheteurs",
  "accounts.subtitle":
    "Créez, désactivez et gérez les identifiants des comptes auditeurs et clients (acheteurs) — la même fonctionnalité que scripts/create-auditor.ts / scripts/create-client.ts et leurs scripts associés de mot de passe/rotation, mais directement depuis la console d'administration plutôt que via un terminal.",

  "suppliers.title": "Performance des fournisseurs et classement de conformité",
  "suppliers.subtitle": "Tableaux de bord comparatifs pour tous les fournisseurs liés",

  "notifications.title": "Notifications et webhooks",
  "notifications.subtitle": "Alertes de conformité automatisées, notifications par e-mail et intégrations webhook sortantes",

  "audit.title": "Journal d'audit et registre de conformité",
  "audit.subtitle": "Registre immuable et chaîné par hachage de chaque action de la plateforme",

  "esg.title": "Analyse ESG de l'entreprise",
  "esg.subtitle": "Résumé développement durable et économie circulaire",

  "greenAccounting.title": "Comptabilité verte et taxe plastique",
  "greenAccounting.subtitle": "Suivi de la taxe européenne sur les emballages plastiques",

  "generator.title": "Suite de génération de certificats de lot et de codes QR",
  "generator.subtitle": "Prévisualisez, personnalisez et imprimez les certificats de conformité et les feuilles d'étiquettes d'usine",

  "search.title": "Recherche globale et filtrage",
  "search.subtitle": "Lots · Certificats · Fournisseurs · Journal d'audit — tout en un coup d'œil",
};

const APP_DICTIONARIES: Record<AppLanguage, AppDictionary> = { EN, DE, FR };

/**
 * Looks up `key` in `lang`'s dictionary, falling back to English, then to
 * the raw key itself — same "degrade to readable text, never blank or
 * crash" rule lib/i18n/dictionaries.ts's own createTranslator uses.
 */
export function translateApp(lang: AppLanguage, key: string): string {
  return APP_DICTIONARIES[lang]?.[key] ?? APP_DICTIONARIES.EN[key] ?? key;
}
