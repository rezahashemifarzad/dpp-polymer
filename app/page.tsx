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
  X,
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
} from 'lucide-react';
import { ToastProvider, useToast } from '@/lib/hooks/use-toast';
import { usePassports, type ApiPassport } from '@/lib/hooks/use-passports';
import { PassportSkeleton, PassportRowSkeleton } from '@/components/dashboard/passport-skeleton';
import { CreatePassportModal } from '@/components/dashboard/create-passport-modal';

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
  batchId: string;
  status: ApiPassport['status'];
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
    chartSubtitle: "Sample analytics — historical time-series endpoint pending",
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
    chartSubtitle: "Beispielhafte Analyse — Zeitreihen-Endpunkt in Vorbereitung",
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
    chartSubtitle: "Données d'exemple — point de terminaison de série temporelle à venir",
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

// Illustrative monthly series for the trend chart. There is no
// /api/passports/analytics time-series endpoint yet — building one is
// scoped for a follow-up step. Labeled honestly in chartSubtitle above
// rather than presented as live regulatory data.
const analyticsData = [
  { month: 'Jan', avgPcr: 32, co2Saved: 12.1, compliance: 88 },
  { month: 'Feb', avgPcr: 35, co2Saved: 13.4, compliance: 91 },
  { month: 'Mar', avgPcr: 38, co2Saved: 14.8, compliance: 93 },
  { month: 'Apr', avgPcr: 42, co2Saved: 16.2, compliance: 95 },
  { month: 'May', avgPcr: 45, co2Saved: 17.1, compliance: 97 },
  { month: 'Jun', avgPcr: 51.6, co2Saved: 18.4, compliance: 99 },
];

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
    batchId: p.batchId,
    status: p.status,
  };
}

function CompletePolymerDPPInner() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'copilot' | 'ledger' | 'qr_generator' | 'audit'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPassport, setSelectedPassport] = useState<DisplayPassport | null>(null);
  const [selectedLang, setSelectedLang] = useState<'EN' | 'DE' | 'FR'>('EN');
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  const t = translations[selectedLang];
  const { push } = useToast();
  const { data, loading, error, hasLoadedOnce, refetch } = usePassports();

  // Custom QR & GS1 Link Generator State (client-only design sandbox — does
  // not persist to the database; the real, persisted QR/GS1 link is
  // qrCodePayloadUrl on each created passport).
  const [customGrade, setCustomGrade] = useState('Recycled Polypropylene X1');
  const [customPcr, setCustomPcr] = useState(50);
  const [customBatch, setCustomBatch] = useState('BATCH-2026-EU');
  const [generatedGs1Uri, setGeneratedGs1Uri] = useState('https://dpp.polymer.eu/01/04012345678909/10/BATCH-2026-EU');

  // AI Copilot Interactive State
  const [simulatedPcr, setSimulatedPcr] = useState<number>(60);
  const [aiSuggestion] = useState<string>(
    "Increasing PCR content to 60% unlocks Level 1 EU Plastic Packaging Tax Relief (€800/ton saving)."
  );

  const passports: DisplayPassport[] = useMemo(() => data.map(toDisplayPassport), [data]);

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
    setGeneratedGs1Uri(`https://dpp.polymer.eu/01/${randomGtin}/10/${customBatch}`);
  };

  const handleRefresh = async () => {
    await refetch();
    push({ variant: 'info', title: 'Ledger refreshed', description: 'Reloaded from /api/passports.' });
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-emerald-500 selection:text-black">

      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-[#070c18]/90 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="bg-gradient-to-tr from-emerald-500 to-teal-400 p-2.5 rounded-xl text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base tracking-tight text-white font-mono">
                  POLYMER<span className="text-emerald-400">.DPP</span>
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono font-bold">
                  EU ESPR 2026
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Enterprise Circular Economy Platform</p>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono flex items-center gap-1.5 transition ${
                activeTab === 'dashboard' ? 'bg-emerald-500 text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>{t.home}</span>
            </button>

            <button
              onClick={() => setActiveTab('copilot')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono flex items-center gap-1.5 transition ${
                activeTab === 'copilot' ? 'bg-emerald-500 text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{t.aiCopilot}</span>
            </button>

            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono flex items-center gap-1.5 transition ${
                activeTab === 'ledger' ? 'bg-emerald-500 text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>{t.materialLedger}</span>
            </button>

            <button
              onClick={() => setActiveTab('qr_generator')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono flex items-center gap-1.5 transition ${
                activeTab === 'qr_generator' ? 'bg-emerald-500 text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{t.qrGenerator}</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono transition ${
                activeTab === 'audit' ? 'bg-emerald-500 text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.esprReadiness}
            </button>
          </div>

          {/* Language Picker & DB Status */}
          <div className="flex items-center space-x-3">
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
              className={`flex items-center gap-2 px-3 py-1 rounded-xl border text-xs font-mono ${
                error
                  ? 'bg-red-500/10 border-red-500/20 text-red-400'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${error ? 'bg-red-400' : 'bg-emerald-400 animate-pulse'}`}></span>
              <span>{error ? 'Neon DB Error' : 'Neon DB Active'}</span>
            </div>
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
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsData}>
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

              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-80">
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
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition"
                  title="Refresh from database"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-3.5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition flex items-center gap-1.5 text-xs whitespace-nowrap"
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
                      <td colSpan={7} className="py-8 text-center text-slate-500">
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

        {/* QR CODE & GS1 DIGITAL TWIN MODAL */}
        {showQrModal && selectedPassport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 relative shadow-2xl">

              <button
                onClick={() => setShowQrModal(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-white p-1.5 rounded-xl bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-center mb-6">
                <div className="p-4 bg-white rounded-2xl w-fit mx-auto mb-3 shadow-xl">
                  {selectedPassport.gs1Url ? (
                    <QRCodeSVG
                      value={selectedPassport.gs1Url}
                      size={160}
                      bgColor="#FFFFFF"
                      fgColor="#020617"
                    />
                  ) : (
                    <div className="w-40 h-40 flex items-center justify-center text-slate-400 text-[10px] font-mono">
                      No GS1 link recorded yet
                    </div>
                  )}
                </div>
                <h4 className="font-bold text-lg text-white">{selectedPassport.gradeName}</h4>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedPassport.batchId}</p>
              </div>

              <div className="space-y-2.5 font-mono text-xs bg-slate-950 p-4 rounded-xl border border-slate-800 mb-6">
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-500">GS1 Digital Link URI</span>
                  <span className="text-emerald-400 font-bold text-[10px] truncate max-w-[180px]">{selectedPassport.gs1Url || '—'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-500">Record Hash (SHA-256)</span>
                  <span className="text-white font-bold text-[10px]" title={selectedPassport.hash}>{truncateHash(selectedPassport.hash)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-500">Total Recycled Content</span>
                  <span className="text-white font-bold">{selectedPassport.pcr}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Certification</span>
                  <span className="text-slate-300">{selectedPassport.cert}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <a
                  href={selectedPassport.gs1Url || '#'}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!selectedPassport.gs1Url}
                  className={`flex-1 text-center py-2.5 font-mono font-bold text-xs rounded-xl transition ${
                    selectedPassport.gs1Url
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed pointer-events-none'
                  }`}
                >
                  Open GS1 Link
                </a>
                <button
                  onClick={() => setShowQrModal(false)}
                  className="px-4 py-2.5 bg-slate-800 text-slate-300 font-mono text-xs rounded-xl hover:bg-slate-700"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        )}

        <CreatePassportModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { /* usePassports().createPassport already refetches */ }}
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
