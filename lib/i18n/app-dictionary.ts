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
 * Global Language Translation for Page Content fix (2026-09-27): the
 * scope used to stop at global nav + each admin page's own header (title +
 * one-line description) — enough to prove the switch worked, but leaving
 * every dashboard's actual body (KPI/stat card labels, action buttons,
 * table column headers, status/tier badges) hardcoded in English. This
 * pass adds that body-content layer for all eight /admin/* dashboards
 * (green-accounting, esg-analytics, audit-log, notification-center,
 * generator-suite, global-search, supplier-ranking, access-control) plus
 * the Admin Console home page's own nav pills — organized as a shared
 * `common.*` namespace for text reused verbatim across dashboards
 * (Refresh, CSV, Status, Actions, …) plus one namespace per dashboard for
 * its own labels. Deliberately still NOT covered, as genuine remaining
 * scope rather than something silently skipped: free-text descriptions,
 * tooltips/`title` attributes, modal-only copy (e.g. the account-creation
 * forms' own field help text), and dynamic data values themselves (an
 * amount, a computed percentage, a supplier's name) — those aren't UI
 * labels, translating them would mean mistranslating the user's own data.
 */

import type { AppLanguage } from "@/lib/hooks/use-language";
import { DASHBOARD_EN, DASHBOARD_DE, DASHBOARD_FR } from "@/lib/i18n/dashboard-dictionary";

export type AppDictionary = Record<string, string>;

const EN: AppDictionary = {
  "nav.home": "Home",
  "nav.admin": "Admin Console",
  "nav.esg": "ESG Analytics",
  "nav.auditor": "Auditor Portal",
  "nav.client": "Client Portal",
  "nav.signin": "Sign In",
  "nav.mainSite": "Main site",
  "nav.backToHome": "Back to Home",

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

  // Shared action/table labels reused verbatim across several dashboards.
  "common.refresh": "Refresh",
  "common.csv": "CSV",
  "common.json": "JSON",
  "common.generating": "Generating...",
  "common.preparing": "Preparing...",
  "common.tryAgain": "Try Again",
  "common.adminConsole": "Admin Console",
  "common.actions": "Actions",
  "common.status": "Status",
  "common.name": "Name",
  "common.email": "Email",
  "common.password": "Password",
  "common.close": "Close",

  // Admin Console home (app/admin/page.tsx) — nav pills.
  "adminHome.link.esg": "ESG Analytics",
  "adminHome.link.auditor": "Auditor Portal",
  "adminHome.link.client": "Client Portal",
  "adminHome.link.greenAccounting": "Green Accounting",
  "adminHome.link.audit": "Audit Log",
  "adminHome.link.notifications": "Notifications",
  "adminHome.link.suppliers": "Suppliers",
  "adminHome.link.generator": "Generator Suite",
  "adminHome.link.accounts": "Accounts",
  "adminHome.link.publicView": "Public View",

  // Green Accounting dashboard — KPI cards, table headers, forecast cards, export buttons.
  "greenAccounting.kpi.grossLiability": "Gross Liability",
  "greenAccounting.kpi.pcrTaxSavings": "PCR Tax Savings",
  "greenAccounting.kpi.netLiability": "Net Liability",
  "greenAccounting.kpi.activeRate": "Active Rate",
  "greenAccounting.table.count": "Count",
  "greenAccounting.table.month": "Month",
  "greenAccounting.table.batches": "Batches",
  "greenAccounting.table.avgPcr": "Avg PCR %",
  "greenAccounting.table.avgCarbon": "Avg Carbon (kg/kg)",
  "greenAccounting.forecast.nextQuarter": "Next Quarter Forecast (Net)",
  "greenAccounting.forecast.next12Months": "Next 12 Months Forecast (Net)",
  "greenAccounting.forecast.trailingActual": "Trailing Actual (Net)",
  "greenAccounting.forecast.projectedChange": "Projected Net Change",
  "greenAccounting.button.exportExcel": "Export Tax & Financial Excel",
  "greenAccounting.button.exportPdf": "Export Green Tax PDF",
  "greenAccounting.table.jurisdiction": "Jurisdiction",
  "greenAccounting.table.label": "Label",
  "greenAccounting.table.rate": "Rate",
  "greenAccounting.table.effectiveFrom": "Effective From",
  "greenAccounting.table.active": "Active",
  "greenAccounting.table.quarter": "Quarter",
  "greenAccounting.table.gross": "Gross",
  "greenAccounting.table.savings": "Savings",
  "greenAccounting.table.net": "Net",
  "greenAccounting.table.year": "Year",
  "greenAccounting.table.quarters": "Quarters",
  "greenAccounting.table.batch": "Batch",
  "greenAccounting.table.manufacturer": "Manufacturer",
  "greenAccounting.table.massKg": "Mass (kg)",
  "greenAccounting.table.pcrKg": "PCR (kg)",
  "greenAccounting.table.valuation": "Valuation",

  // ESG Analytics dashboard — KPI cards, export buttons, table headers.
  "esg.kpi.pcrMass": "PCR Mass Consumed",
  "esg.kpi.carbonFootprint": "Carbon Footprint (Verified)",
  "esg.kpi.taxRelief": "Est. EU Plastic Tax Relief",
  "esg.kpi.certCompliance": "Certification Compliance",
  "esg.button.exportDataSheets": "Export ESG Data Sheets",
  "esg.button.exportCompliancePdf": "Export Compliance PDF",
  "esg.table.manufacturer": "Manufacturer",
  "esg.table.polymerGrade": "Polymer / Grade",
  "esg.table.avgCarbon": "Avg Carbon",

  // Audit Log dashboard — action buttons, table headers.
  "audit.button.verifyLedger": "Verify Full Ledger",
  "audit.button.verifying": "Verifying...",
  "audit.button.exportExcel": "Export Audit Log Excel",
  "audit.table.seq": "Seq",
  "audit.table.timestamp": "Timestamp",
  "audit.table.action": "Action",
  "audit.table.actor": "Actor",
  "audit.table.batchId": "Batch ID",
  "audit.table.entryHash": "Entry Hash",
  "audit.table.chainLink": "Chain Link",

  // Notifications & Webhooks dashboard — overview chips, action button, delivery-log table headers.
  "notifications.chip.expired": "Expired",
  "notifications.chip.urgent": "Urgent",
  "notifications.chip.soon": "Soon",
  "notifications.chip.anomalies": "Anomalies",
  "notifications.chip.activeWebhooks": "Active Webhooks",
  "notifications.button.runSweep": "Run Sweep Now",
  "notifications.table.when": "When",
  "notifications.table.batch": "Batch",
  "notifications.table.event": "Event",
  "notifications.table.channel": "Channel",
  "notifications.table.detail": "Detail",

  // Generator Suite dashboard — section headers, download buttons.
  "generator.section.livePreview": "Live Preview",
  "generator.section.labelSheetSettings": "Label Sheet Settings",
  "generator.button.downloadCertPdf": "Download Certificate PDF",
  "generator.button.downloadLabelSheet": "Download Label Sheet PDF",

  // Global Search dashboard — search box placeholder, entity-type labels.
  "search.placeholder": "Search batch IDs, grades, certificate numbers, suppliers, actors...",
  "search.entity.batches": "Batches",
  "search.entity.certificates": "Certificates",
  "search.entity.suppliers": "Suppliers",
  "search.entity.auditLog": "Audit Log",
  "search.filters": "Filters",

  // Supplier Ranking dashboard — export button, KPI chips, tier badges, table headers.
  "suppliers.button.exportCsv": "Export CSV",
  "suppliers.kpi.rankedSuppliers": "Ranked Suppliers",
  "suppliers.tier.preferred": "Preferred",
  "suppliers.tier.approved": "Approved",
  "suppliers.tier.watch": "Watch",
  "suppliers.tier.atRisk": "At Risk",
  "suppliers.kpi.certsExpiring": "Certs Expiring/Expired",
  "suppliers.table.supplier": "Supplier",
  "suppliers.table.tier": "Tier",
  "suppliers.table.compliance": "Compliance",
  "suppliers.table.currency": "Currency",
  "suppliers.table.avgPcr": "Avg PCR",
  "suppliers.table.avgPcf": "Avg PCF",
  "suppliers.table.certExpiry": "Cert Expiry",
  "suppliers.table.score": "Score",

  // Access Control (Accounts) page — panel section headers, table headers.
  "accounts.section.auditorAccounts": "Auditor Accounts",
  "accounts.section.buyerAccounts": "Buyer (Client) Accounts",
  "accounts.table.organization": "Organization",
  "accounts.table.company": "Company",
  "accounts.table.country": "Country",
  "accounts.table.contactEmail": "Contact Email",
};

const DE: AppDictionary = {
  "nav.home": "Startseite",
  "nav.admin": "Admin-Konsole",
  "nav.esg": "ESG-Analyse",
  "nav.auditor": "Prüferportal",
  "nav.client": "Kundenportal",
  "nav.signin": "Anmelden",
  "nav.mainSite": "Zur Website",
  "nav.backToHome": "Zurück zur Startseite",

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

  "common.refresh": "Aktualisieren",
  "common.csv": "CSV",
  "common.json": "JSON",
  "common.generating": "Wird erstellt…",
  "common.preparing": "Wird vorbereitet…",
  "common.tryAgain": "Erneut versuchen",
  "common.adminConsole": "Admin-Konsole",
  "common.actions": "Aktionen",
  "common.status": "Status",
  "common.name": "Name",
  "common.email": "E-Mail",
  "common.password": "Passwort",
  "common.close": "Schließen",

  "adminHome.link.esg": "ESG-Analyse",
  "adminHome.link.auditor": "Prüferportal",
  "adminHome.link.client": "Kundenportal",
  "adminHome.link.greenAccounting": "Green Accounting",
  "adminHome.link.audit": "Prüfprotokoll",
  "adminHome.link.notifications": "Benachrichtigungen",
  "adminHome.link.suppliers": "Lieferanten",
  "adminHome.link.generator": "Generator-Suite",
  "adminHome.link.accounts": "Konten",
  "adminHome.link.publicView": "Öffentliche Ansicht",

  "greenAccounting.kpi.grossLiability": "Bruttoverbindlichkeit",
  "greenAccounting.kpi.pcrTaxSavings": "PCR-Steuerersparnis",
  "greenAccounting.kpi.netLiability": "Nettoverbindlichkeit",
  "greenAccounting.kpi.activeRate": "Aktive Rate",
  "greenAccounting.table.count": "Anzahl",
  "greenAccounting.table.month": "Monat",
  "greenAccounting.table.batches": "Chargen",
  "greenAccounting.table.avgPcr": "Ø PCR %",
  "greenAccounting.table.avgCarbon": "Ø CO₂ (kg/kg)",
  "greenAccounting.forecast.nextQuarter": "Prognose nächstes Quartal (netto)",
  "greenAccounting.forecast.next12Months": "Prognose nächste 12 Monate (netto)",
  "greenAccounting.forecast.trailingActual": "Tatsächlich, rückblickend (netto)",
  "greenAccounting.forecast.projectedChange": "Prognostizierte Nettoveränderung",
  "greenAccounting.button.exportExcel": "Steuer- & Finanz-Excel exportieren",
  "greenAccounting.button.exportPdf": "Grüne Steuer-PDF exportieren",
  "greenAccounting.table.jurisdiction": "Rechtsraum",
  "greenAccounting.table.label": "Bezeichnung",
  "greenAccounting.table.rate": "Satz",
  "greenAccounting.table.effectiveFrom": "Gültig ab",
  "greenAccounting.table.active": "Aktiv",
  "greenAccounting.table.quarter": "Quartal",
  "greenAccounting.table.gross": "Brutto",
  "greenAccounting.table.savings": "Ersparnis",
  "greenAccounting.table.net": "Netto",
  "greenAccounting.table.year": "Jahr",
  "greenAccounting.table.quarters": "Quartale",
  "greenAccounting.table.batch": "Charge",
  "greenAccounting.table.manufacturer": "Hersteller",
  "greenAccounting.table.massKg": "Masse (kg)",
  "greenAccounting.table.pcrKg": "PCR (kg)",
  "greenAccounting.table.valuation": "Bewertung",

  "esg.kpi.pcrMass": "Verbrauchte PCR-Masse",
  "esg.kpi.carbonFootprint": "CO₂-Fußabdruck (verifiziert)",
  "esg.kpi.taxRelief": "Geschätzte EU-Plastiksteuerentlastung",
  "esg.kpi.certCompliance": "Zertifizierungs-Compliance",
  "esg.button.exportDataSheets": "ESG-Datenblätter exportieren",
  "esg.button.exportCompliancePdf": "Compliance-PDF exportieren",
  "esg.table.manufacturer": "Hersteller",
  "esg.table.polymerGrade": "Polymer / Güteklasse",
  "esg.table.avgCarbon": "Ø CO₂",

  "audit.button.verifyLedger": "Vollständiges Register prüfen",
  "audit.button.verifying": "Wird geprüft…",
  "audit.button.exportExcel": "Prüfprotokoll-Excel exportieren",
  "audit.table.seq": "Lfd. Nr.",
  "audit.table.timestamp": "Zeitstempel",
  "audit.table.action": "Aktion",
  "audit.table.actor": "Akteur",
  "audit.table.batchId": "Chargen-ID",
  "audit.table.entryHash": "Eintrags-Hash",
  "audit.table.chainLink": "Kettenverknüpfung",

  "notifications.chip.expired": "Abgelaufen",
  "notifications.chip.urgent": "Dringend",
  "notifications.chip.soon": "Bald",
  "notifications.chip.anomalies": "Anomalien",
  "notifications.chip.activeWebhooks": "Aktive Webhooks",
  "notifications.button.runSweep": "Prüfung jetzt ausführen",
  "notifications.table.when": "Wann",
  "notifications.table.batch": "Charge",
  "notifications.table.event": "Ereignis",
  "notifications.table.channel": "Kanal",
  "notifications.table.detail": "Detail",

  "generator.section.livePreview": "Live-Vorschau",
  "generator.section.labelSheetSettings": "Etikettenbogen-Einstellungen",
  "generator.button.downloadCertPdf": "Zertifikat-PDF herunterladen",
  "generator.button.downloadLabelSheet": "Etikettenbogen-PDF herunterladen",

  "search.placeholder": "Chargen-IDs, Güteklassen, Zertifikatsnummern, Lieferanten, Akteure durchsuchen…",
  "search.entity.batches": "Chargen",
  "search.entity.certificates": "Zertifikate",
  "search.entity.suppliers": "Lieferanten",
  "search.entity.auditLog": "Prüfprotokoll",
  "search.filters": "Filter",

  "suppliers.button.exportCsv": "CSV exportieren",
  "suppliers.kpi.rankedSuppliers": "Bewertete Lieferanten",
  "suppliers.tier.preferred": "Bevorzugt",
  "suppliers.tier.approved": "Genehmigt",
  "suppliers.tier.watch": "Beobachtung",
  "suppliers.tier.atRisk": "Gefährdet",
  "suppliers.kpi.certsExpiring": "Zertifikate laufen ab/abgelaufen",
  "suppliers.table.supplier": "Lieferant",
  "suppliers.table.tier": "Stufe",
  "suppliers.table.compliance": "Compliance",
  "suppliers.table.currency": "Währung",
  "suppliers.table.avgPcr": "Ø PCR",
  "suppliers.table.avgPcf": "Ø PCF",
  "suppliers.table.certExpiry": "Zertifikatsablauf",
  "suppliers.table.score": "Bewertung",

  "accounts.section.auditorAccounts": "Prüferkonten",
  "accounts.section.buyerAccounts": "Käuferkonten (Kunden)",
  "accounts.table.organization": "Organisation",
  "accounts.table.company": "Unternehmen",
  "accounts.table.country": "Land",
  "accounts.table.contactEmail": "Kontakt-E-Mail",
};

const FR: AppDictionary = {
  "nav.home": "Accueil",
  "nav.admin": "Console d'administration",
  "nav.esg": "Analyse ESG",
  "nav.auditor": "Portail auditeur",
  "nav.client": "Portail client",
  "nav.signin": "Connexion",
  "nav.mainSite": "Site principal",
  "nav.backToHome": "Retour à l'accueil",

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

  "common.refresh": "Actualiser",
  "common.csv": "CSV",
  "common.json": "JSON",
  "common.generating": "Génération…",
  "common.preparing": "Préparation…",
  "common.tryAgain": "Réessayer",
  "common.adminConsole": "Console d'administration",
  "common.actions": "Actions",
  "common.status": "Statut",
  "common.name": "Nom",
  "common.email": "E-mail",
  "common.password": "Mot de passe",
  "common.close": "Fermer",

  "adminHome.link.esg": "Analyse ESG",
  "adminHome.link.auditor": "Portail auditeur",
  "adminHome.link.client": "Portail client",
  "adminHome.link.greenAccounting": "Comptabilité verte",
  "adminHome.link.audit": "Journal d'audit",
  "adminHome.link.notifications": "Notifications",
  "adminHome.link.suppliers": "Fournisseurs",
  "adminHome.link.generator": "Suite de génération",
  "adminHome.link.accounts": "Comptes",
  "adminHome.link.publicView": "Vue publique",

  "greenAccounting.kpi.grossLiability": "Passif brut",
  "greenAccounting.kpi.pcrTaxSavings": "Économies fiscales PCR",
  "greenAccounting.kpi.netLiability": "Passif net",
  "greenAccounting.kpi.activeRate": "Taux actif",
  "greenAccounting.table.count": "Nombre",
  "greenAccounting.table.month": "Mois",
  "greenAccounting.table.batches": "Lots",
  "greenAccounting.table.avgPcr": "PCR moy. %",
  "greenAccounting.table.avgCarbon": "CO₂ moy. (kg/kg)",
  "greenAccounting.forecast.nextQuarter": "Prévision trimestre prochain (net)",
  "greenAccounting.forecast.next12Months": "Prévision 12 prochains mois (net)",
  "greenAccounting.forecast.trailingActual": "Réel glissant (net)",
  "greenAccounting.forecast.projectedChange": "Variation nette prévue",
  "greenAccounting.button.exportExcel": "Exporter Excel fiscal et financier",
  "greenAccounting.button.exportPdf": "Exporter le PDF taxe verte",
  "greenAccounting.table.jurisdiction": "Juridiction",
  "greenAccounting.table.label": "Libellé",
  "greenAccounting.table.rate": "Taux",
  "greenAccounting.table.effectiveFrom": "En vigueur à partir de",
  "greenAccounting.table.active": "Actif",
  "greenAccounting.table.quarter": "Trimestre",
  "greenAccounting.table.gross": "Brut",
  "greenAccounting.table.savings": "Économies",
  "greenAccounting.table.net": "Net",
  "greenAccounting.table.year": "Année",
  "greenAccounting.table.quarters": "Trimestres",
  "greenAccounting.table.batch": "Lot",
  "greenAccounting.table.manufacturer": "Fabricant",
  "greenAccounting.table.massKg": "Masse (kg)",
  "greenAccounting.table.pcrKg": "PCR (kg)",
  "greenAccounting.table.valuation": "Évaluation",

  "esg.kpi.pcrMass": "Masse PCR consommée",
  "esg.kpi.carbonFootprint": "Empreinte carbone (vérifiée)",
  "esg.kpi.taxRelief": "Allègement fiscal plastique UE estimé",
  "esg.kpi.certCompliance": "Conformité de certification",
  "esg.button.exportDataSheets": "Exporter les fiches de données ESG",
  "esg.button.exportCompliancePdf": "Exporter le PDF de conformité",
  "esg.table.manufacturer": "Fabricant",
  "esg.table.polymerGrade": "Polymère / Qualité",
  "esg.table.avgCarbon": "CO₂ moy.",

  "audit.button.verifyLedger": "Vérifier le registre complet",
  "audit.button.verifying": "Vérification…",
  "audit.button.exportExcel": "Exporter le journal d'audit Excel",
  "audit.table.seq": "N°",
  "audit.table.timestamp": "Horodatage",
  "audit.table.action": "Action",
  "audit.table.actor": "Acteur",
  "audit.table.batchId": "ID de lot",
  "audit.table.entryHash": "Hachage de l'entrée",
  "audit.table.chainLink": "Lien de chaîne",

  "notifications.chip.expired": "Expiré",
  "notifications.chip.urgent": "Urgent",
  "notifications.chip.soon": "Bientôt",
  "notifications.chip.anomalies": "Anomalies",
  "notifications.chip.activeWebhooks": "Webhooks actifs",
  "notifications.button.runSweep": "Lancer la vérification",
  "notifications.table.when": "Quand",
  "notifications.table.batch": "Lot",
  "notifications.table.event": "Événement",
  "notifications.table.channel": "Canal",
  "notifications.table.detail": "Détail",

  "generator.section.livePreview": "Aperçu en direct",
  "generator.section.labelSheetSettings": "Paramètres de la feuille d'étiquettes",
  "generator.button.downloadCertPdf": "Télécharger le certificat PDF",
  "generator.button.downloadLabelSheet": "Télécharger la feuille d'étiquettes PDF",

  "search.placeholder": "Rechercher des ID de lot, qualités, numéros de certificat, fournisseurs, acteurs…",
  "search.entity.batches": "Lots",
  "search.entity.certificates": "Certificats",
  "search.entity.suppliers": "Fournisseurs",
  "search.entity.auditLog": "Journal d'audit",
  "search.filters": "Filtres",

  "suppliers.button.exportCsv": "Exporter CSV",
  "suppliers.kpi.rankedSuppliers": "Fournisseurs classés",
  "suppliers.tier.preferred": "Préféré",
  "suppliers.tier.approved": "Approuvé",
  "suppliers.tier.watch": "Sous surveillance",
  "suppliers.tier.atRisk": "À risque",
  "suppliers.kpi.certsExpiring": "Certificats expirant/expirés",
  "suppliers.table.supplier": "Fournisseur",
  "suppliers.table.tier": "Niveau",
  "suppliers.table.compliance": "Conformité",
  "suppliers.table.currency": "Devise",
  "suppliers.table.avgPcr": "PCR moy.",
  "suppliers.table.avgPcf": "PCF moy.",
  "suppliers.table.certExpiry": "Expiration du certificat",
  "suppliers.table.score": "Score",

  "accounts.section.auditorAccounts": "Comptes auditeurs",
  "accounts.section.buyerAccounts": "Comptes acheteurs (clients)",
  "accounts.table.organization": "Organisation",
  "accounts.table.company": "Société",
  "accounts.table.country": "Pays",
  "accounts.table.contactEmail": "E-mail de contact",
};

const APP_DICTIONARIES: Record<AppLanguage, AppDictionary> = {
  EN: { ...EN, ...DASHBOARD_EN },
  DE: { ...DE, ...DASHBOARD_DE },
  FR: { ...FR, ...DASHBOARD_FR },
};

/**
 * Looks up `key` in `lang`'s dictionary, falling back to English, then to
 * the raw key itself — same "degrade to readable text, never blank or
 * crash" rule lib/i18n/dictionaries.ts's own createTranslator uses.
 */
export function translateApp(
  lang: AppLanguage,
  key: string,
  vars?: Record<string, string | number | null | undefined>
): string {
  const text = APP_DICTIONARIES[lang]?.[key] ?? APP_DICTIONARIES.EN[key] ?? key;
  if (!vars) return text;
  // Fill {name} placeholders; an unknown placeholder is left visible rather
  // than silently dropped, so a missing variable is easy to spot.
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name] ?? "") : match
  );
}
