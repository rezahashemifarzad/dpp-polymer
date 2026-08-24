'use client';

import React, { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import {
  ShieldCheck,
  ArrowUpRight,
  Search,
  Sparkles,
  TrendingUp,
  Languages,
  Bot,
  Plus,
  RefreshCw,
  ChevronRight,
  QrCode,
  Home,
  Table,
  AlertTriangle,
  Settings2,
  BarChart3,
  BadgeCheck,
  Printer,
  FileSpreadsheet,
  Loader2,
  LayoutGrid,
} from 'lucide-react';
import Link from 'next/link';
import { ToastProvider, useToast } from '@/lib/hooks/use-toast';
import { usePassports, type ApiPassport } from '@/lib/hooks/use-passports';
import { usePassportTrend } from '@/lib/hooks/use-passport-trend';
import { QrCodeModal } from '@/components/dashboard/qr-code-modal';
import { QrLabelSheetModal, type QrLabelCandidate } from '@/components/dashboard/qr-label-sheet-modal';
import { PassportSkeleton, PassportRowSkeleton } from '@/components/dashboard/passport-skeleton';
import { CreatePassportModal } from '@/components/dashboard/create-passport-modal';
import { BatchDetailsModal } from '@/components/dashboard/batch-details-modal';

// Same source of truth as lib/qr.ts's buildGs1VerificationUrl — set via
// NEXT_PUBLIC_BASE_URL (.env.local for local dev) so this client-side demo
// widget's preview link stays consistent with the real, persisted GS1
// links generated server-side, instead of a hardcoded production domain.
const PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

interface DisplayPassport {
  id: string;
  gradeName: string;
  polymerType: string;
  manufacturer: string;
  pcr: number;
  cert: string;
  co2: string;
  riskScore: 'Low' | 'Medium' | 'High';
  recyclability: number;
  origin: string;
  hash: string;
  gs1Url: string;
  gtin: string;
  batchId: string;
  status: ApiPassport['status'];
  // Circular Economy Platform Upgrade — used only to render the "Manage"
  // button's green dot indicator without a per-row lookup against `data`.
  // The full ApiPassport (needed by BatchDetailsModal) is still looked up
  // from `data` by id when the button is clicked — see manageTargetId.
  hasGenealogyOrCarbon: boolean;
}

// 🌐 سیستم کامل ترجمه برای تمام اجزای برنامه
const translations = {
  EN: {
    home: "Home",
    aiCopilot: "AI Copilot",
    materialLedger: "Material Ledger",
    qrGenerator: "QR & GS1 Generator",
    esprReadiness: "ESPR Readiness",
    activePassports: "Active Passports",
    avgPcr: "Avg. PCR Content",
    europeanSites: "Manufacturer Sites",
    co2Avoided: "Avg. Carbon Intensity",
    pcrChartTitle: "PCR Scaling & Regulatory Readiness Index",
    chartSubtitle: "Live monthly trend, computed from recorded production dates",
    activePolymerPassports: "Active Polymer Grade Passports",
    viewFullLedger: "View Full Material Ledger →",
    aiStudioTitle: "AI Formulation Copilot",
    aiStudioDesc: "Adjust parameters to simulate compliance with EU Regulation 2024/1781 and calculate tax savings.",
    simulatePcr: "Simulate Target PCR (%)",
    taxSavings: "EU Plastic Tax Savings",
    co2Reduction: "CO2 Reduction Potential",
    recyclabilityScore: "Recyclability Score",
    deployFormulation: "Deploy Optimized Grade Formulation",
    aiOutputTitle: "Technical Grade Spec Sheet",
    aiOutputDesc: "Real-time parameters generated based on EU Circular Economy mandates.",
    recycledIndex: "Recycled Polypropylene Index",
    auditStatus: "Audit Exemption Status",
    searchPlaceholder: "Search grade, batch, or GTIN...",
    gs1StudioTitle: "GS1 Digital Link Studio",
    gs1StudioDesc: "Generate EU-compliant GS1 Digital Link URIs and downloadable QR codes for packaging batches.",
    gradeLabel: "Polymer Grade Name",
    batchLabel: "Production Batch Number",
    generateBtn: "Generate GS1 Digital Link & QR",
    gs1Status: "GS1 Status",
    activeLink: "Active Link",
    esprTitle: "EU ESPR 2026 Audit Matrix",
    esprDesc: "Real-time compliance checks according to European Commission Material Transparency Framework",
    recycledProv: "Recycled Content Provenance",
    recycledProvDesc: "All chain-of-custody data tracked using ISCC PLUS mass balance verification.",
    gs1Interop: "GS1 Digital Link Interoperability",
    gs1InteropDesc: "Unique URI identifiers embedded on physical polymer packaging batches.",
  },
  DE: {
    home: "Startseite",
    aiCopilot: "KI-Copilot",
    materialLedger: "Materialregister",
    qrGenerator: "QR & GS1 Generator",
    esprReadiness: "ESPR-Bereitschaft",
    activePassports: "Aktive Pässe",
    avgPcr: "Durchschn. PCR-Gehalt",
    europeanSites: "Herstellerstandorte",
    co2Avoided: "Ø CO2-Intensität",
    pcrChartTitle: "PCR-Skalierung & Regulierungs-Readiness-Index",
    chartSubtitle: "Live-Monatstrend, berechnet aus erfassten Produktionsdaten",
    activePolymerPassports: "Aktive Polymer-Gütepässe",
    viewFullLedger: "Vollständiges Materialregister anzeigen →",
    aiStudioTitle: "KI-Formulierungs-Copilot",
    aiStudioDesc: "Parameter anpassen, um die Einhaltung der EU-Verordnung 2024/1781 zu simulieren und Steuereinsparungen zu berechnen.",
    simulatePcr: "Ziel-PCR simulieren (%)",
    taxSavings: "EU-Kunststoffsteuer-Einsparung",
    co2Reduction: "CO2-Reduktionspotenzial",
    recyclabilityScore: "Recyclingfähigkeits-Score",
    deployFormulation: "Optimierte Formulierung anwenden",
    aiOutputTitle: "Technisches Datenblatt der Qualität",
    aiOutputDesc: "Echtzeit-Parameter basierend auf den EU-Kreislaufwirtschafts-Mandaten.",
    recycledIndex: "Rezyklat-Polypropylen-Index",
    auditStatus: "Audit-Befreiungsstatus",
    searchPlaceholder: "Typ, Charge oder GTIN suchen...",
    gs1StudioTitle: "GS1 Digital Link Studio",
    gs1StudioDesc: "Erzeugen Sie EU-konforme GS1 Digital Link URIs und herunterladbare QR-Codes für Produktionschargen.",
    gradeLabel: "Polymer-Qualitätsbezeichnung",
    batchLabel: "Produktionschargennummer",
    generateBtn: "GS1 Digital Link & QR erzeugen",
    gs1Status: "GS1-Status",
    activeLink: "Aktiver Link",
    esprTitle: "EU ESPR 2026 Audit-Matrix",
    esprDesc: "Echtzeit-Compliance-Prüfungen gemäß dem Materialtransparenz-Rahmen der Europäischen Kommission",
    recycledProv: "Herkunft des Rezyklatgehalts",
    recycledProvDesc: "Alle Chain-of-Custody-Daten werden mittels ISCC PLUS Massenbilanz-Verifizierung verfolgt.",
    gs1Interop: "GS1 Digital Link Interoperabilität",
    gs1InteropDesc: "Eindeutige URI-Kennungen, die auf physischen Polymer-Verpackungschargen eingebettet sind.",
  },
  FR: {
    home: "Accueil",
    aiCopilot: "Copilote IA",
    materialLedger: "Registre des Matériaux",
    qrGenerator: "Générateur QR & GS1",
    esprReadiness: "Conformité ESPR",
    activePassports: "Passeports Actifs",
    avgPcr: "Teneur Moyenne en PCR",
    europeanSites: "Sites Fabricants",
    co2Avoided: "Intensité Carbone Moy.",
    pcrChartTitle: "Mise à l'échelle du PCR & Indice de Conformité",
    chartSubtitle: "Tendance mensuelle en direct, calculée à partir des dates de production",
    activePolymerPassports: "Passeports Polymères Actifs",
    viewFullLedger: "Voir le registre complet des matériaux →",
    aiStudioTitle: "Copilote de Formulation IA",
    aiStudioDesc: "Ajustez les paramètres pour simuler la conformité au règlement UE 2024/1781 et calculer les économies d'impôt.",
    simulatePcr: "Simuler le PCR Cible (%)",
    taxSavings: "Économies d'Impôt Plastique UE",
    co2Reduction: "Potentiel de Réduction de CO2",
    recyclabilityScore: "Score de Recyclabilité",
    deployFormulation: "Déployer la Formulation Optimisée",
    aiOutputTitle: "Fiche Technique de Qualité",
    aiOutputDesc: "Paramètres en temps réel générés selon les directives de l'économie circulaire de l'UE.",
    recycledIndex: "Indice de Polypropylène Recyclé",
    auditStatus: "Statut d'Exemption d'Audit",
    searchPlaceholder: "Rechercher grade, lot ou GTIN...",
    gs1StudioTitle: "Studio GS1 Digital Link",
    gs1StudioDesc: "Générez des URI GS1 Digital Link conformes à l'UE et des codes QR téléchargeables pour les lots d'emballage.",
    gradeLabel: "Nom du Grade Polymère",
    batchLabel: "Numéro de Lot de Production",
    generateBtn: "Générer Lien Digital GS1 & QR",
    gs1Status: "Statut GS1",
    activeLink: "Lien Actif",
    esprTitle: "Matrice d'Audit UE ESPR 2026",
    esprDesc: "Vérifications de conformité en temps réel selon le cadre de transparence des matériaux de la Commission Européenne",
    recycledProv: "Traçabilité du Contenu Recyclé",
    recycledProvDesc: "Toutes les données de chaîne de contrôle sont suivies via la vérification du bilan massique ISCC PLUS.",
    gs1Interop: "Interopérabilité GS1 Digital Link",
    gs1InteropDesc: "Identifiants URI uniques intégrés sur les lots d'emballages physiques en polymère.",
  }
};

// Sprint 2.1: the trend chart below now reads from GET
// /api/passports/analytics (lib/services/passport-monthly-trend.ts) via
// usePassportTrend() instead of a hard-coded sample array — see that
// hook's call site further down in this component.

/**
 * UI-only heuristics — NOT certified compliance metrics. Derived client-side
 * from real ledger fields purely to give the dashboard cards a quick visual
 * signal. Never surface these as audit-grade figures; the certified numbers
 * are recycledContentPercent / totalRecycledPercent / certifications on the
 * passport record itself.
 */
function estimateRiskScore(p: ApiPassport): 'Low' | 'Medium' | 'High' {
  if (p.status === 'REVOKED') return 'High';
  const hasCert = p.certifications.length > 0;
  if (hasCert && p.lcaThirdPartyVerified) return 'Low';
  if (hasCert) return 'Medium';
  return 'High';
}

function estimateRecyclability(p: ApiPassport): number {
  const total = Number(p.totalRecycledPercent || '0');
  return Math.min(99, Math.round(total + 30));
}

function truncateHash(hash: string | null, lead = 10, tail = 6): string {
  if (!hash) return '—';
  if (hash.length <= lead + tail) return hash;
  return `${hash.slice(0, lead)}...${hash.slice(-tail)}`;
}

function toDisplayPassport(p: ApiPassport): DisplayPassport {
  return {
    id: p.id,
    gradeName: p.grade,
    polymerType: p.polymerType,
    manufacturer: p.manufacturer?.legalName ?? 'Unknown Manufacturer',
    pcr: Math.round(Number(p.totalRecycledPercent || '0')),
    cert: p.certifications.map((c) => c.scheme).join(' / ') || 'Pending Certification',
    co2: Number(p.carbonFootprintKgCO2ePerKg || '0').toFixed(2),
    riskScore: estimateRiskScore(p),
    recyclability: estimateRecyclability(p),
    origin: p.manufacturer?.country ?? '—',
    hash: p.recordHash ?? '—',
    gs1Url: p.qrCodePayloadUrl ?? '',
    gtin: p.gtin,
    batchId: p.batchId,
    status: p.status,
    hasGenealogyOrCarbon: p.parentLinks.length > 0 || p.carbonFootprintCalculation !== null,
  };
}

function CompletePolymerDPPInner() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'copilot' | 'ledger' | 'qr_generator' | 'audit'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPassport, setSelectedPassport] = useState<DisplayPassport | null>(null);
  const [selectedLang, setSelectedLang] = useState<'EN' | 'DE' | 'FR'>('EN');
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  // Sprint 2.2 — Factory Batch Labeling: bulk QR label sheet picker,
  // separate from the single-batch showQrModal above.
  const [showLabelSheetModal, setShowLabelSheetModal] = useState<boolean>(false);
  // Sprint 2.3 — Enterprise Compliance Reporting & PDF/Excel Export Module:
  // "Download Ledger Excel" fetch+blob round trip against
  // GET /api/passports/ledger-export.xlsx (see lib/services/generate-ledger-workbook.ts).
  const [exportingLedger, setExportingLedger] = useState<boolean>(false);
  // Circular Economy Platform Upgrade (Step 3) — this was previously only
  // wired into app/admin/page.tsx. This root dashboard's "Material Ledger"
  // tab is a second, independent table over the same data (see the file
  // banner history in app/admin/page.tsx for why two copies exist) and
  // needs its own Manage entry point.
  const [manageTargetId, setManageTargetId] = useState<string | null>(null);

  const t = translations[selectedLang];
  const { push } = useToast();
  const {
    data,
    loading,
    error,
    hasLoadedOnce,
    refetch,
    createPassport,
    linkParentBatch,
    calculateCarbonFootprint,
    addChainOfCustodyRecord,
  } = usePassports();
  // Sprint 2.1 — live monthly trend for the chart below (replaces the old
  // hard-coded analyticsData array). See lib/hooks/use-passport-trend.ts /
  // lib/services/passport-monthly-trend.ts.
  const { data: trendData, loading: trendLoading, error: trendError } = usePassportTrend();

  // Custom QR & GS1 Link Generator State (client-only design sandbox — does
  // not persist to the database; the real, persisted QR/GS1 link is
  // qrCodePayloadUrl on each created passport).
  const [customGrade, setCustomGrade] = useState('Recycled Polypropylene X1');
  const [customPcr, setCustomPcr] = useState(50);
  const [customBatch, setCustomBatch] = useState('BATCH-2026-EU');
  const [generatedGs1Uri, setGeneratedGs1Uri] = useState(`${PUBLIC_BASE_URL}/01/04012345678909/21/BATCH-2026-EU`);

  // AI Copilot Interactive State
  const [simulatedPcr, setSimulatedPcr] = useState<number>(60);
  const [aiSuggestion] = useState<string>(
    "Increasing PCR content to 60% unlocks Level 1 EU Plastic Packaging Tax Relief (€800/ton saving)."
  );

  const passports: DisplayPassport[] = useMemo(() => data.map(toDisplayPassport), [data]);

  // Sprint 2.2 — normalized shape for QrLabelSheetModal (page-shape-agnostic,
  // see that component's file banner for why).
  const qrLabelCandidates: QrLabelCandidate[] = useMemo(
    () =>
      passports.map((p) => ({
        id: p.id,
        batchId: p.batchId,
        label: p.gradeName,
        polymerType: p.polymerType,
        gtin: p.gtin,
        qrUrl: p.gs1Url || null,
      })),
    [passports]
  );

  const filteredPassports = passports.filter(p =>
    p.gradeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.batchId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.manufacturer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCount = passports.filter((p) => p.status !== 'REVOKED').length;
  const avgPcr = passports.length
    ? (passports.reduce((sum, p) => sum + p.pcr, 0) / passports.length).toFixed(1)
    : '0.0';
  const manufacturerSiteCount = new Set(data.map((p) => p.manufacturer?.legalName).filter(Boolean)).size;
  const avgCarbonIntensity = passports.length
    ? (passports.reduce((sum, p) => sum + Number(p.co2), 0) / passports.length).toFixed(2)
    : '0.00';

  const handleGenerateGs1 = () => {
    const randomGtin = Math.floor(10000000000000 + Math.random() * 90000000000000);
    setGeneratedGs1Uri(`${PUBLIC_BASE_URL}/01/${randomGtin}/21/${customBatch}`);
  };

  const handleRefresh = async () => {
    await refetch();
    push({ variant: 'info', title: 'Ledger refreshed', description: 'Reloaded from /api/passports.' });
  };

  // Sprint 2.3 — fetch+blob (not a bare <a href> click) so a genuine
  // failure surfaces as a toast instead of silently opening a JSON error
  // body as if it were the workbook, matching the QrLabelSheetModal
  // download pattern from Sprint 2.2.
  const handleExportLedgerExcel = async () => {
    setExportingLedger(true);
    try {
      const res = await fetch('/api/passports/ledger-export.xlsx');
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `Request failed with status ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `polymer-dpp-ledger-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      push({ variant: 'success', title: 'Ledger Excel exported', description: 'Material Ledger + Audit Trail workbook downloaded.' });
    } catch (err) {
      push({
        variant: 'error',
        title: 'Excel export failed',
        description: err instanceof Error ? err.message : 'Failed to generate the ledger workbook.',
      });
    } finally {
      setExportingLedger(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-emerald-500 selection:text-black overflow-x-hidden">

      {/* Top Navigation Bar. Row 1 (logo + language/DB status) uses
          min-h-16 + flex-wrap instead of a fixed h-16 + no-wrap, so the
          right-hand cluster drops to its own line rather than overflowing
          the viewport on a phone; Row 2 (the six view-switch tabs, added
          below) is desktop-unchanged (`hidden md:flex`) plus a new
          `md:hidden` horizontally-scrollable mirror so phone users can
          still reach every tab instead of losing them outright. */}
      <header className="border-b border-slate-800/80 bg-[#070c18]/90 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-16 py-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">

          {/* Logo */}
          <div className="flex items-center space-x-3 cursor-pointer min-w-0" onClick={() => setActiveTab('dashboard')}>
            <div className="bg-gradient-to-tr from-emerald-500 to-teal-400 p-2.5 rounded-xl text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-extrabold text-base tracking-tight text-white font-mono">
                  POLYMER<span className="text-emerald-400">.DPP</span>
                </h1>
                {/* Regulatory compliance badge — deliberately muted/neutral
                    rather than brand-emerald, so it reads as an official
                    standards seal (like an ISO/CE mark) rather than another
                    call-to-action pill competing with the brand accent.
                    The BadgeCheck icon carries the one hint of accent color;
                    the label itself stays soft slate. flex-wrap on the
                    parent row lets this drop to its own line on very narrow
                    viewports instead of forcing an overflow/squeeze. */}
                <span className="inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full bg-white/[0.04] border border-slate-600/50 whitespace-nowrap">
                  <BadgeCheck className="w-3 h-3 text-emerald-400/80 shrink-0" />
                  <span className="text-[10px] font-medium font-mono tracking-wide text-slate-300">
                    EU ESPR 2026
                  </span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Enterprise Circular Economy Platform</p>
            </div>
          </div>

          {/* Navigation Links — audit finding: at exactly the md breakpoint
              (roughly 768-950px, squarely inside the "tablet" band) this row
              didn't have room for all six labels, and since neither the
              buttons nor the row itself resisted shrinking, flexbox wrapped
              each label internally ("AI Copilot" breaking after "AI", etc.)
              instead of wrapping the row as a whole — a genuinely broken,
              jumbled two-line button bar. shrink-0 + whitespace-nowrap on
              every item (so a button's own content can never wrap) plus
              shrink-0 on the container (so the row wraps as a single unit
              onto its own line within Row 1's flex-wrap instead of
              collapsing internally) fixes it without changing anything
              about how this bar looks whenever it *does* fit on one line. */}
          <div className="hidden md:flex items-center space-x-1 bg-slate-900 border border-slate-800 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono flex items-center gap-1.5 transition ${
                activeTab === 'dashboard' ? 'bg-emerald-500 text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>{t.home}</span>
            </button>

            <button
              onClick={() => setActiveTab('copilot')}
              className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono flex items-center gap-1.5 transition ${
                activeTab === 'copilot' ? 'bg-emerald-500 text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{t.aiCopilot}</span>
            </button>

            <button
              onClick={() => setActiveTab('ledger')}
              className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono flex items-center gap-1.5 transition ${
                activeTab === 'ledger' ? 'bg-emerald-500 text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>{t.materialLedger}</span>
            </button>

            <button
              onClick={() => setActiveTab('qr_generator')}
              className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono flex items-center gap-1.5 transition ${
                activeTab === 'qr_generator' ? 'bg-emerald-500 text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{t.qrGenerator}</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono transition ${
                activeTab === 'audit' ? 'bg-emerald-500 text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.esprReadiness}
            </button>

            {/* Corporate ESG Analytics & Sustainability Dashboard — a real
                Next.js route (app/admin/esg-analytics/page.tsx), not a
                client-side tab like the buttons above, so this is a <Link>
                navigation rather than a setActiveTab() call. */}
            <Link
              href="/admin/esg-analytics"
              className="shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono flex items-center gap-1.5 transition text-slate-400 hover:text-white"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>ESG Analytics</span>
            </Link>

            {/* Phase 6 (Batch Certificate & Dynamic QR Generator Suite) —
                same real-route <Link> pattern as ESG Analytics above
                (a Next.js page, not a client-side tab). Added here AND to
                app/admin/page.tsx's nav row per the "two independent
                Material Ledger UIs" rule — see qr-code-modal.tsx's banner
                for why QR/labeling UI changes reach both. */}
            <Link
              href="/admin/generator"
              className="shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono flex items-center gap-1.5 transition text-slate-400 hover:text-white"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Generator Suite</span>
            </Link>
          </div>

          {/* Language Picker & DB Status — shrink-0 so the flex-wrap on the
              row above moves this whole cluster to its own line rather than
              compressing it; the "Neon DB Active/Error" label collapses to
              just the status dot below sm, since the label text alone was
              ~110-130px this couldn't otherwise spare on a 360px phone. */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs font-mono text-slate-300">
              <Languages className="w-3.5 h-3.5 text-emerald-400" />
              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value as 'EN' | 'DE' | 'FR')}
                className="bg-transparent focus:outline-none text-xs cursor-pointer font-bold text-emerald-400"
              >
                <option value="EN" className="bg-slate-900 text-white">EN</option>
                <option value="DE" className="bg-slate-900 text-white">DE</option>
                <option value="FR" className="bg-slate-900 text-white">FR</option>
              </select>
            </div>

            <div
              className={`flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded-xl border text-xs font-mono ${
                error
                  ? 'bg-red-500/10 border-red-500/20 text-red-400'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${error ? 'bg-red-400' : 'bg-emerald-400 animate-pulse'}`}></span>
              <span className="hidden sm:inline whitespace-nowrap">{error ? 'Neon DB Error' : 'Neon DB Active'}</span>
            </div>
          </div>

        </div>

        {/* Row 2 (mobile only) — the exact same six destinations as the
            desktop pill nav above, mirrored rather than reused so the
            desktop block above is completely untouched. A horizontally
            scrollable strip is the standard mobile pattern for a tab bar
            wider than the viewport (GitHub/Twitter use the same approach)
            and avoids ever wrapping a tab's label mid-word or clipping a
            tab off the edge of the screen. */}
        <div className="md:hidden max-w-7xl mx-auto px-4 pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono flex items-center gap-1.5 transition ${
                activeTab === 'dashboard' ? 'bg-emerald-500 text-slate-950 font-bold shadow-md' : 'text-slate-400'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>{t.home}</span>
            </button>

            <button
              onClick={() => setActiveTab('copilot')}
              className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono flex items-center gap-1.5 transition ${
                activeTab === 'copilot' ? 'bg-emerald-500 text-slate-950 font-bold shadow-md' : 'text-slate-400'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{t.aiCopilot}</span>
            </button>

            <button
              onClick={() => setActiveTab('ledger')}
              className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono flex items-center gap-1.5 transition ${
                activeTab === 'ledger' ? 'bg-emerald-500 text-slate-950 font-bold shadow-md' : 'text-slate-400'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>{t.materialLedger}</span>
            </button>

            <button
              onClick={() => setActiveTab('qr_generator')}
              className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono flex items-center gap-1.5 transition ${
                activeTab === 'qr_generator' ? 'bg-emerald-500 text-slate-950 font-bold shadow-md' : 'text-slate-400'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{t.qrGenerator}</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono transition ${
                activeTab === 'audit' ? 'bg-emerald-500 text-slate-950 font-bold shadow-md' : 'text-slate-400'
              }`}
            >
              {t.esprReadiness}
            </button>

            <Link
              href="/admin/esg-analytics"
              className="shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono flex items-center gap-1.5 transition text-slate-400"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>ESG Analytics</span>
            </Link>

            <Link
              href="/admin/generator"
              className="shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono flex items-center gap-1.5 transition text-slate-400"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Generator Suite</span>
            </Link>
          </div>
        </div>
      </header>

      {/* AI Copilot Alert Banner */}
      <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/60 border-b border-emerald-500/20 px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-emerald-300">
            <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
            <span className="font-bold uppercase font-mono tracking-wider">AI Passport Copilot Active:</span>
            <span className="text-slate-300">{aiSuggestion}</span>
          </div>
          <button
            onClick={() => setActiveTab('copilot')}
            className="text-emerald-400 hover:underline font-mono text-[11px] font-bold flex items-center gap-1"
          >
            Optimize Material Grade <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Fetch error banner */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-2xl px-4 py-3 text-xs font-mono">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">Could not load passports from /api/passports: {error}</span>
            <button
              onClick={handleRefresh}
              className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded-lg font-bold flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        </div>
      )}

      {/* Main Content View */}
      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* TAB 1: EXECUTIVE DASHBOARD (HOME) */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{t.activePassports}</div>
                <div className="text-3xl font-extrabold text-white font-mono mt-1">
                  {loading && !hasLoadedOnce ? '—' : activeCount.toLocaleString()}
                </div>
                <div className="text-[11px] text-emerald-400 mt-2 font-mono flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Live from Neon
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{t.avgPcr}</div>
                <div className="text-3xl font-extrabold text-emerald-400 font-mono mt-1">
                  {loading && !hasLoadedOnce ? '—' : `${avgPcr}%`}
                </div>
                <div className="text-[11px] text-slate-400 mt-2 font-mono">Across all recorded batches</div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{t.europeanSites}</div>
                <div className="text-3xl font-extrabold text-purple-400 font-mono mt-1">
                  {loading && !hasLoadedOnce ? '—' : manufacturerSiteCount.toLocaleString()}
                </div>
                <div className="text-[11px] text-purple-300 mt-2 font-mono">Distinct manufacturers in ledger</div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{t.co2Avoided}</div>
                <div className="text-3xl font-extrabold text-teal-400 font-mono mt-1">
                  {loading && !hasLoadedOnce ? '—' : avgCarbonIntensity} <span className="text-xs text-slate-400 font-normal">kg CO2e/kg</span>
                </div>
                <div className="text-[11px] text-teal-300 mt-2 font-mono">PEF cradle-to-gate average</div>
              </div>
            </div>

            {/* Recharts Area Chart */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-base font-bold text-white">{t.pcrChartTitle}</h3>
                  <p className="text-xs text-slate-400 font-mono">{t.chartSubtitle}</p>
                </div>
                <div className="flex items-center space-x-4 text-xs font-mono">
                  <span className="flex items-center gap-1 text-emerald-400"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> PCR %</span>
                  <span className="flex items-center gap-1 text-blue-400"><span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span> ESPR Readiness Score</span>
                </div>
              </div>

              <div className="h-64 w-full">
                {trendLoading && trendData.length === 0 ? (
                  <div className="h-full flex items-center justify-center gap-2 text-xs text-slate-500 font-mono">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Loading live trend from /api/passports/analytics…
                  </div>
                ) : trendError ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-xs text-red-400 font-mono text-center px-6">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Could not load trend data: {trendError}</span>
                  </div>
                ) : trendData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono text-center px-6">
                    No production-dated batches recorded yet — this chart populates automatically as passports are issued.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="pcrColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="readinessColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '12px', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="avgPcr" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#pcrColor)" name="PCR Content %" />
                      <Area type="monotone" dataKey="compliance" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#readinessColor)" name="Compliance Score" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Visual Polymer Cards */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-white">{t.activePolymerPassports}</h3>
                <button
                  onClick={() => setActiveTab('ledger')}
                  className="text-xs text-emerald-400 hover:underline font-mono"
                >
                  {t.viewFullLedger}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {loading && !hasLoadedOnce ? (
                  <>
                    <PassportSkeleton />
                    <PassportSkeleton />
                    <PassportSkeleton />
                  </>
                ) : passports.length === 0 ? (
                  <div className="md:col-span-3 bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-10 text-center">
                    <p className="text-sm text-slate-400 font-mono">No passports yet.</p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl"
                    >
                      <Plus className="w-3.5 h-3.5" /> Issue First Passport
                    </button>
                  </div>
                ) : (
                  passports.slice(0, 6).map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-900/60 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 backdrop-blur-xl transition group relative overflow-hidden"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                          {item.batchId}
                        </span>
                        <button
                          onClick={() => { setSelectedPassport(item); setShowQrModal(true); }}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition"
                          title="Show QR Code"
                        >
                          <QrCode className="w-4 h-4 text-emerald-400" />
                        </button>
                      </div>

                      <h4 className="font-bold text-base text-white group-hover:text-emerald-400 transition">{item.gradeName}</h4>
                      <p className="text-xs text-slate-400 mb-4">{item.polymerType}</p>

                      <div className="space-y-2 text-xs font-mono border-t border-slate-800 pt-3">
                        <div className="flex justify-between">
                          <span className="text-slate-500">TOTAL RECYCLED CONTENT:</span>
                          <span className="text-emerald-400 font-bold">{item.pcr}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Carbon Impact:</span>
                          <span className="text-teal-400">{item.co2} kg CO2/kg</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Certification:</span>
                          <span className="text-slate-300 truncate max-w-[160px] text-right">{item.cert}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Manufacturer:</span>
                          <span className="text-slate-300">{item.manufacturer}</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
                        <span>Inspect GS1 Digital Twin</span>
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <ArrowUpRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: AI COPILOT INTERACTIVE STUDIO */}
        {activeTab === 'copilot' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-5 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl space-y-6">
              <div className="flex items-center space-x-2 text-emerald-400">
                <Bot className="w-6 h-6" />
                <h3 className="text-lg font-bold text-white">{t.aiStudioTitle}</h3>
              </div>
              <p className="text-xs text-slate-400">{t.aiStudioDesc}</p>

              <div>
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-slate-300">{t.simulatePcr}</span>
                  <span className="text-emerald-400 font-bold text-base">{simulatedPcr}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="90"
                  value={simulatedPcr}
                  onChange={(e) => setSimulatedPcr(Number(e.target.value))}
                  className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">{t.taxSavings}:</span>
                  <span className="text-emerald-400 font-bold">€{(simulatedPcr * 1200).toLocaleString()} / year</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t.co2Reduction}:</span>
                  <span className="text-teal-400 font-bold">{(simulatedPcr * 0.04).toFixed(2)} kg/kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t.recyclabilityScore}:</span>
                  <span className="text-blue-400 font-bold">{Math.min(99, simulatedPcr + 30)}%</span>
                </div>
              </div>

              <button
                onClick={() => push({ variant: 'info', title: 'Formulation saved', description: `${simulatedPcr}% PCR target noted for this session.` })}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold font-mono text-xs rounded-xl shadow-lg shadow-emerald-500/20"
              >
                {t.deployFormulation}
              </button>
            </div>

            <div className="md:col-span-7 bg-slate-900/50 border border-slate-800 rounded-3xl p-8 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest block mb-2">AI Optimization Output</span>
                <h3 className="text-2xl font-bold text-white mb-2">{t.aiOutputTitle}</h3>
                <p className="text-xs text-slate-400 mb-6">{t.aiOutputDesc}</p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-mono block">{t.recycledIndex}</span>
                    <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">{simulatedPcr}% PCR</span>
                  </div>
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-mono block">{t.auditStatus}</span>
                    <span className="text-base font-bold font-mono text-teal-400 mt-1 block">Level 1 Approved</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 font-mono mt-6">
                ✔ Grade meets German VerpackG & EU ESPR 2026 transparency standards.
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MATERIAL LEDGER TABLE */}
        {activeTab === 'ledger' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">{t.materialLedger}</h3>
                <p className="text-xs text-slate-400 font-mono">Cryptographically verified entries synced with Neon DB</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 min-w-[160px] md:w-80">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder={t.searchPlaceholder}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  onClick={handleRefresh}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition shrink-0"
                  title="Refresh from database"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setShowLabelSheetModal(true)}
                  className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition flex items-center gap-1.5 text-xs whitespace-nowrap shrink-0"
                  title="Generate a print-ready QR label sheet"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Labels
                </button>
                <button
                  onClick={handleExportLedgerExcel}
                  disabled={exportingLedger}
                  className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 font-bold rounded-xl transition flex items-center gap-1.5 text-xs whitespace-nowrap shrink-0"
                  title="Download the Material Ledger & Audit Trail as an Excel workbook"
                >
                  {exportingLedger ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  )}
                  {exportingLedger ? 'Exporting...' : 'Download Ledger Excel'}
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-3.5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition flex items-center gap-1.5 text-xs whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> New Passport
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px]">
                    <th className="py-3 px-4">Batch ID</th>
                    <th className="py-3 px-4">Polymer Matrix / Grade</th>
                    <th className="py-3 px-4">Manufacturer</th>
                    <th className="py-3 px-4">Recycled %</th>
                    <th className="py-3 px-4">Certifications</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">GS1 Digital Link</th>
                    <th className="py-3 px-4 text-right">Genealogy / Carbon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading && !hasLoadedOnce ? (
                    <>
                      <PassportRowSkeleton />
                      <PassportRowSkeleton />
                      <PassportRowSkeleton />
                    </>
                  ) : filteredPassports.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        {passports.length === 0 ? 'No passports issued yet.' : 'No passports match your search.'}
                      </td>
                    </tr>
                  ) : (
                    filteredPassports.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-4 px-4 text-emerald-400 font-bold">{item.batchId}</td>
                        <td className="py-4 px-4 font-bold text-white">{item.gradeName}</td>
                        <td className="py-4 px-4 text-slate-300">{item.manufacturer}</td>
                        <td className="py-4 px-4 text-emerald-400 font-bold">{item.pcr}%</td>
                        <td className="py-4 px-4 text-slate-400 truncate max-w-[220px]">{item.cert}</td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            item.status === 'ISSUED' ? 'bg-emerald-500/10 text-emerald-400' :
                            item.status === 'REVOKED' ? 'bg-red-500/10 text-red-400' :
                            'bg-amber-500/10 text-amber-400'
                          }`}>
                            {item.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => { setSelectedPassport(item); setShowQrModal(true); }}
                            className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg transition text-[11px] font-bold"
                          >
                            Show QR & Twin
                          </button>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => setManageTargetId(item.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition text-[11px] font-bold"
                          >
                            <Settings2 className="w-3 h-3" />
                            Manage
                            {item.hasGenealogyOrCarbon && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: QR CODE & GS1 DIGITAL LINK GENERATOR (design sandbox) */}
        {activeTab === 'qr_generator' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-6 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl space-y-4">
              <div className="flex items-center space-x-2 text-emerald-400">
                <QrCode className="w-5 h-5" />
                <h3 className="text-lg font-bold text-white">{t.gs1StudioTitle}</h3>
              </div>
              <p className="text-xs text-slate-400">{t.gs1StudioDesc}</p>
              <p className="text-[10px] text-slate-500 font-mono">
                Sandbox preview only — issuing a real passport via &quot;New Passport&quot; in the Material Ledger tab
                generates the persisted, hash-sealed GS1 Digital Link automatically.
              </p>
              {/* Phase 6 — this sandbox has no real batch data or export
                  capability by design (see file banner); point admins at
                  the real, production Generator Suite for actual
                  certificate/label-sheet output instead of expanding this
                  demo widget into something it was never meant to be. */}
              <Link
                href="/admin/generator"
                className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-emerald-400 hover:text-emerald-300"
              >
                <LayoutGrid className="w-3 h-3" />
                Generate a real certificate or label sheet in the Generator Suite
                <ChevronRight className="w-3 h-3" />
              </Link>

              <div className="space-y-3 font-mono text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">{t.gradeLabel}</label>
                  <input
                    type="text"
                    value={customGrade}
                    onChange={(e) => setCustomGrade(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">PCR Percentage (%): {customPcr}%</label>
                  <input
                    type="range"
                    min="10" max="90"
                    value={customPcr}
                    onChange={(e) => setCustomPcr(Number(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">{t.batchLabel}</label>
                  <input
                    type="text"
                    value={customBatch}
                    onChange={(e) => setCustomBatch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>

                <button
                  onClick={handleGenerateGs1}
                  className="w-full py-3 bg-emerald-500 text-slate-950 font-bold rounded-xl hover:bg-emerald-400 transition"
                >
                  {t.generateBtn}
                </button>
              </div>
            </div>

            <div className="md:col-span-6 bg-slate-900/50 border border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center text-center">
              <div className="p-4 bg-white rounded-2xl shadow-2xl mb-4">
                <QRCodeSVG value={generatedGs1Uri} size={180} />
              </div>
              <h4 className="font-bold text-base text-white">{customGrade}</h4>
              <p className="text-xs text-emerald-400 font-mono mt-1">{customPcr}% PCR Content</p>

              <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-xl w-full text-left font-mono text-[10px] text-slate-400">
                <span className="text-slate-500 block">GS1 URI Target:</span>
                <span className="text-emerald-400 break-all">{generatedGs1Uri}</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: ESPR AUDIT READINESS */}
        {activeTab === 'audit' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl space-y-6">
            <h3 className="text-xl font-bold text-white">{t.esprTitle}</h3>
            <p className="text-xs text-slate-400 font-mono">{t.esprDesc}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 font-mono text-xs">
                <div className="text-emerald-400 font-bold text-sm">✔ {t.recycledProv}</div>
                <p className="text-slate-400">{t.recycledProvDesc}</p>
              </div>

              <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 font-mono text-xs">
                <div className="text-emerald-400 font-bold text-sm">✔ {t.gs1Interop}</div>
                <p className="text-slate-400">{t.gs1InteropDesc}</p>
              </div>
            </div>
          </div>
        )}

        {/* QR CODE & GS1 DIGITAL TWIN MODAL
            Sprint 2.2 — replaces the old ad-hoc preview-only modal with the
            reusable QrCodeModal (adds PNG/SVG download, see that file's
            banner). The record hash / PCR% / certification panel the old
            modal showed is preserved via QrCodeModal's optional `details`
            prop rather than dropped. */}
        {selectedPassport && (
          <QrCodeModal
            open={showQrModal}
            onClose={() => setShowQrModal(false)}
            batchId={selectedPassport.batchId}
            label={selectedPassport.gradeName}
            qrUrl={selectedPassport.gs1Url || null}
            details={[
              { label: 'Record Hash (SHA-256)', value: truncateHash(selectedPassport.hash), title: selectedPassport.hash || undefined },
              { label: 'Total Recycled Content', value: `${selectedPassport.pcr}%` },
              { label: 'Certification', value: selectedPassport.cert },
            ]}
          />
        )}

        {/* Sprint 2.2 — Factory Batch Labeling: bulk print-ready QR label
            sheet picker over the full ledger, independent of any single
            selected row. */}
        <QrLabelSheetModal
          open={showLabelSheetModal}
          onClose={() => setShowLabelSheetModal(false)}
          passports={qrLabelCandidates}
        />

        <CreatePassportModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { /* usePassports().createPassport already refetches */ }}
          // FIX (discovered while wiring the Manage button into this page):
          // this required prop was never passed, so clicking "New Passport"
          // here threw "onCreate is not a function" at submit time — masked
          // in production because next.config.ts sets
          // typescript.ignoreBuildErrors: true, so the missing-prop type
          // error never blocked the build. This is the same createPassport
          // Server Action wrapper already used by app/admin/page.tsx.
          onCreate={createPassport}
        />

        <BatchDetailsModal
          open={manageTargetId !== null}
          onClose={() => setManageTargetId(null)}
          // Re-derive from the live list (not a stale snapshot) so the modal
          // reflects the just-saved state immediately after each refetch()
          // triggered by linkParentBatch / calculateCarbonFootprint.
          passport={manageTargetId ? data.find((p) => p.id === manageTargetId) ?? null : null}
          allPassports={data}
          onLinkParent={linkParentBatch}
          onCalculateCarbon={calculateCarbonFootprint}
          onAddChainOfCustody={addChainOfCustodyRecord}
        />

      </main>
    </div>
  );
}

export default function CompletePolymerDPP() {
  return (
    <ToastProvider>
      <CompletePolymerDPPInner />
    </ToastProvider>
  );
}
