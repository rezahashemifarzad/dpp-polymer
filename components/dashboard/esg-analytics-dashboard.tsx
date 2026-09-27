"use client";

// FIX (round 4 — language selector didn't translate admin pages): this
// dashboard's own header (title + subtitle) translated via
// lib/i18n/app-dictionary.ts — see that file's banner for scope.
import { useLanguage } from "@/lib/hooks/use-language";

/**
 * components/dashboard/esg-analytics-dashboard.tsx
 * -----------------------------------------------------------------------
 * Corporate ESG Analytics & Sustainability Dashboard — renders the summary
 * computed server-side by lib/services/esg-analytics.ts (see
 * app/admin/esg-analytics/page.tsx, a Server Component that fetches once
 * and passes the whole EsgAnalyticsSummary down as a prop). Purely
 * presentational + the CSV/JSON export buttons — no client-side data
 * fetching, so there's no risk of this page showing numbers that disagree
 * with what the server just computed.
 *
 * Chart design follows this repo's dataviz conventions (see the AreaChart
 * in app/page.tsx's dashboard tab for the established gradient/tooltip
 * style, which this mirrors) plus one hard rule: PCR% and carbon
 * intensity (kg CO2e/kg) are different units on different scales, so they
 * are always two separate single-axis charts — never one dual-axis chart.
 * A plain data table beneath the charts gives a non-chart, screen-reader-
 * friendly view of the same monthly figures.
 */

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  ArrowLeft,
  RefreshCw,
  Recycle,
  Leaf,
  TrendingUp,
  BadgeCheck,
  Download,
  FileJson,
  FileText,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  Gauge,
  Info,
  Coins,
  Lock,
  ArrowUpRight,
  FileSpreadsheet,
  Award,
  Target,
  Factory,
  Boxes,
} from "lucide-react";
import type { EsgAnalyticsSummary, EsgReadinessComponent } from "@/lib/services/esg-analytics";
import type { PortfolioGreenAccountingSummary } from "@/lib/services/plastic-tax-calculator";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_VERIFICATION: "Pending Verification",
  ISSUED: "Issued",
  REVOKED: "Revoked",
  SUPERSEDED: "Superseded",
};

const numberFmt = (n: number, maxFractionDigits = 1) =>
  n.toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadBlob(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildCsv(summary: EsgAnalyticsSummary): string {
  const lines: string[] = [];
  lines.push("Corporate ESG Analytics & Sustainability Summary");
  lines.push(`Generated At,${csvEscape(summary.generatedAt)}`);
  lines.push("");
  lines.push("Metric,Value,Unit");
  lines.push(`Total Batches,${summary.totalBatches},count`);
  lines.push(`Active Batches (excludes Revoked/Superseded),${summary.activeBatches},count`);
  lines.push(`Excluded Batches,${summary.excludedBatches},count`);
  lines.push(`PCR Mass Consumed,${summary.pcrMass.pcrMassKg},kg`);
  lines.push(`PIR Mass (context only),${summary.pcrMass.pirMassKg},kg`);
  lines.push(`Total Weighed Mass,${summary.pcrMass.totalMassKg},kg`);
  lines.push(`PCR Adoption Rate,${summary.pcrMass.pcrAdoptionRatePercent},%`);
  lines.push(`Batches With Weight Data,${summary.pcrMass.batchesWithWeightData},count`);
  lines.push(`Batches Missing Weight Data,${summary.pcrMass.batchesMissingWeightData},count`);
  lines.push(
    `Total Verified Carbon Footprint (LCA x mass),${summary.carbon.totalVerifiedKgCO2e ?? "n/a"},kg CO2e`
  );
  lines.push(
    `Total Illustrative Carbon Estimate,${summary.carbon.totalIllustrativeEstimateKgCO2e ?? "n/a"},kg CO2e`
  );
  lines.push(
    `Avg Verified Carbon Intensity,${summary.carbon.avgVerifiedIntensityKgCO2ePerKg ?? "n/a"},kg CO2e/kg`
  );
  lines.push(`Third-Party Verified LCA Batches,${summary.carbon.thirdPartyVerifiedCount},count`);
  lines.push(`Third-Party Verified LCA Rate,${summary.carbon.thirdPartyVerifiedPercent},%`);
  lines.push(`EU Plastic Tax Relief Rate,${summary.taxRelief.ratePerTonneEur},EUR/tonne`);
  lines.push(`Estimated Tax Relief,${summary.taxRelief.estimatedReliefEur},EUR`);
  lines.push(`Total Certifications,${summary.compliance.totalCertifications},count`);
  lines.push(`Certifications Verified,${summary.compliance.verified} (${summary.compliance.verifiedPercent}%),count`);
  lines.push(
    `Certifications Pending Review,${summary.compliance.pendingReview} (${summary.compliance.pendingReviewPercent}%),count`
  );
  lines.push(`Certifications Rejected,${summary.compliance.rejected} (${summary.compliance.rejectedPercent}%),count`);
  lines.push(`Verified Certs Currently Valid,${summary.compliance.verifiedCurrentlyValid},count`);
  lines.push(`Verified Certs Expiring Soon,${summary.compliance.verifiedExpiringSoon},count`);
  lines.push(`Verified Certs Expired,${summary.compliance.verifiedExpired},count`);
  lines.push("");
  lines.push("Batches by Status");
  lines.push("Status,Count");
  for (const [status, count] of Object.entries(summary.statusBreakdown)) {
    lines.push(`${csvEscape(STATUS_LABELS[status] ?? status)},${count}`);
  }
  lines.push("");
  lines.push("Monthly Trend");
  lines.push("Month,Batch Count,Avg Recycled Content %,Avg Verified Carbon Intensity (kg CO2e/kg)");
  for (const point of summary.monthlyTrend) {
    lines.push(
      `${point.month},${point.batchCount},${point.avgRecycledContentPercent},${point.avgVerifiedCarbonIntensityKgCO2ePerKg}`
    );
  }
  lines.push("");
  lines.push("Sustainability Readiness Index");
  lines.push(`Overall Score,${summary.readinessIndex.overallScore},/100`);
  lines.push(`Rating,${csvEscape(summary.readinessIndex.rating)}`);
  lines.push("Component,Score,Weight,Detail");
  for (const c of summary.readinessIndex.components) {
    lines.push(`${csvEscape(c.label)},${c.score},${c.weight * 100}%,${csvEscape(c.detail)}`);
  }
  lines.push("");
  lines.push("PPWR Regulatory Target Comparison");
  lines.push("Category,Year,Target %,Actual %,Gap (pp),On Track");
  for (const t of summary.regulatoryCompliance.targets) {
    lines.push(
      `${csvEscape(t.category)},${t.year},${t.targetPercent},${t.actualPercent},${t.gapPercentagePoints},${t.onTrack ? "Yes" : "No"}`
    );
  }
  lines.push("");
  lines.push("Manufacturer Distribution");
  lines.push("Manufacturer,Country,Batches,% of Portfolio,Avg Recycled %,Avg Verified Carbon (kg/kg),Mass (kg)");
  for (const m of summary.manufacturerDistribution) {
    lines.push(
      `${csvEscape(m.manufacturerName)},${csvEscape(m.country ?? "—")},${m.batchCount},${m.batchCountPercent},${m.avgRecycledContentPercent},${m.avgVerifiedCarbonIntensityKgCO2ePerKg ?? "n/a"},${m.totalMassKg}`
    );
  }
  lines.push("");
  lines.push("Material Grade Distribution");
  lines.push("Polymer Type,Grade,Batches,% of Portfolio,Avg Recycled %");
  for (const g of summary.gradeDistribution) {
    lines.push(`${csvEscape(g.polymerType)},${csvEscape(g.grade)},${g.batchCount},${g.batchCountPercent},${g.avgRecycledContentPercent}`);
  }
  lines.push("");
  lines.push(`Disclaimer,${csvEscape(summary.taxRelief.disclaimer)}`);
  lines.push(`PPWR Disclaimer,${csvEscape(summary.regulatoryCompliance.disclaimer)}`);
  return lines.join("\n");
}

function KpiCard({
  icon: Icon,
  label,
  value,
  unit,
  accent,
  sub,
}: {
  icon: typeof Recycle;
  label: string;
  value: string;
  unit?: string;
  accent: string;
  sub?: ReactNode;
}) {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
        <Icon className={`w-3.5 h-3.5 ${accent}`} />
        {label}
      </div>
      <div className={`text-2xl font-extrabold font-mono mt-1.5 ${accent}`}>
        {value}
        {unit && <span className="text-xs text-slate-400 font-normal ml-1">{unit}</span>}
      </div>
      {sub && <div className="text-[11px] text-slate-400 mt-2 font-mono">{sub}</div>}
    </div>
  );
}

// NOTE: barColorClass/textColorClass are always passed as full, literal
// Tailwind class strings (never built with template interpolation or
// string.replace()) — Tailwind v4's JIT scanner only picks up class names
// that appear verbatim in source, so a runtime-derived "bg-x" -> "text-x"
// swap would silently produce unstyled icons in the production build.
interface StatusSegment {
  label: string;
  count: number;
  percent: number;
  barColorClass: string;
  textColorClass: string;
  icon: typeof CheckCircle2;
}

function StackedStatusBar({ segments }: { segments: StatusSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  return (
    <div>
      <div className="flex w-full h-3 rounded-full overflow-hidden gap-[2px] bg-slate-950">
        {segments.map((s) =>
          s.count > 0 ? (
            <div
              key={s.label}
              className={`${s.barColorClass} rounded-full`}
              style={{ width: `${total > 0 ? (s.count / total) * 100 : 0}%` }}
              title={`${s.label}: ${s.count} (${s.percent}%)`}
            />
          ) : null
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3">
        {segments.map((s) => {
          const SIcon = s.icon;
          return (
            <div key={s.label} className="flex items-center gap-1.5 text-[11px] font-mono">
              <SIcon className={`w-3 h-3 ${s.textColorClass}`} />
              <span className="text-slate-300">{s.label}</span>
              <span className="text-slate-500">
                {s.count} ({s.percent}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EsgAnalyticsDashboard({
  summary,
  greenAccounting,
}: {
  summary: EsgAnalyticsSummary;
  // Optional so this component still renders correctly if ever called
  // without the Sprint 3.1 data (e.g. an older caller) — the widget below
  // simply doesn't render rather than crashing on a missing prop.
  greenAccounting?: PortfolioGreenAccountingSummary;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  // Sprint 2.3 (Enterprise Compliance Reporting & PDF/Excel Export Module)
  // — unlike the CSV/JSON exports above (built entirely client-side from
  // the `summary` prop already in hand), the compliance PDF is rendered
  // server-side (lib/services/generate-compliance-report-pdf.tsx pulls its
  // own live batch/auditor-sign-off data beyond what this page has), so it
  // needs a real fetch+blob round trip with its own loading/error state.
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Phase 5 (Advanced ESG & Carbon Analytics Dashboard) — the dedicated
  // "ESG Data Sheets" workbook (manufacturer distribution, grade
  // distribution, PPWR target comparison, readiness index breakdown; see
  // lib/services/generate-esg-analytics-workbook.ts). Server-rendered like
  // the Compliance PDF above, so it gets its own independent loading/error
  // state rather than reusing pdfExporting/pdfError.
  const [esgXlsxExporting, setEsgXlsxExporting] = useState(false);
  const [esgXlsxError, setEsgXlsxError] = useState<string | null>(null);

  // Sprint 3.2 (Green Tax & Audit Reports Export) — the widget's own two
  // export buttons, distinct state from the Compliance PDF export above
  // since they hit different routes and can be in flight independently.
  const [greenPdfExporting, setGreenPdfExporting] = useState(false);
  const [greenPdfError, setGreenPdfError] = useState<string | null>(null);
  const [greenXlsxExporting, setGreenXlsxExporting] = useState(false);
  const [greenXlsxError, setGreenXlsxError] = useState<string | null>(null);

  const handleExportGreenPdf = async () => {
    setGreenPdfError(null);
    setGreenPdfExporting(true);
    try {
      const res = await fetch("/api/passports/green-tax-report.pdf");
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `Request failed with status ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `polymer-dpp-green-tax-report-${summary.generatedAt.slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setGreenPdfError(err instanceof Error ? err.message : "Failed to generate green tax report PDF");
    } finally {
      setGreenPdfExporting(false);
    }
  };

  const handleExportGreenXlsx = async () => {
    setGreenXlsxError(null);
    setGreenXlsxExporting(true);
    try {
      const res = await fetch("/api/passports/green-tax-export.xlsx");
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `Request failed with status ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `polymer-dpp-green-tax-export-${summary.generatedAt.slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setGreenXlsxError(err instanceof Error ? err.message : "Failed to generate tax & financial Excel export");
    } finally {
      setGreenXlsxExporting(false);
    }
  };

  const pcrTrendData = useMemo(
    () => summary.monthlyTrend.map((p) => ({ month: p.month, avgPcr: p.avgRecycledContentPercent })),
    [summary.monthlyTrend]
  );
  const carbonTrendData = useMemo(
    () =>
      summary.monthlyTrend.map((p) => ({
        month: p.month,
        avgCarbon: p.avgVerifiedCarbonIntensityKgCO2ePerKg,
      })),
    [summary.monthlyTrend]
  );

  const handleRefresh = () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleExportJson = () => {
    downloadBlob(
      `esg-summary-${summary.generatedAt.slice(0, 10)}.json`,
      JSON.stringify(summary, null, 2),
      "application/json"
    );
  };
  const handleExportCsv = () => {
    downloadBlob(`esg-summary-${summary.generatedAt.slice(0, 10)}.csv`, buildCsv(summary), "text/csv");
  };

  const handleExportPdf = async () => {
    setPdfError(null);
    setPdfExporting(true);
    try {
      const res = await fetch("/api/passports/compliance-report.pdf");
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `Request failed with status ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `polymer-dpp-compliance-report-${summary.generatedAt.slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Failed to generate compliance report PDF");
    } finally {
      setPdfExporting(false);
    }
  };

  const handleExportEsgXlsx = async () => {
    setEsgXlsxError(null);
    setEsgXlsxExporting(true);
    try {
      const res = await fetch("/api/passports/esg-analytics-export.xlsx");
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `Request failed with status ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `polymer-dpp-esg-data-sheets-${summary.generatedAt.slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setEsgXlsxError(err instanceof Error ? err.message : "Failed to generate ESG data sheets workbook");
    } finally {
      setEsgXlsxExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans overflow-x-hidden">
      {/* Header — was a fixed h-16 row with a back-link+title block and a
          timestamp+3-button block crammed side by side; at phone widths the
          two blocks together are wider than the viewport. min-h-16 + flex-wrap
          (instead of a fixed height + no-wrap) lets the button block drop to
          its own line instead of forcing horizontal overflow, and the button
          block itself also wraps as a safety net for in-between widths. */}
      {/* Bug fix — top offset bumped from 0 to the shared admin-offset
          token (SiteNav's 3.5rem + the admin sign-out bar's 2rem — see
          app/admin/layout.tsx's own comment and the
          --spacing-admin-offset definition in app/globals.css) now that
          both of those are sticky too; top-0 here would have made this
          header fight them for the same viewport position. */}
      <header className="border-b border-slate-800/80 bg-[#070c18]/90 backdrop-blur-2xl sticky top-admin-offset z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-16 py-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/admin"
              className="shrink-0 flex items-center gap-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-2 rounded-lg transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t("common.adminConsole")}
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white tracking-tight">{t("esg.title")}</h1>
              <p className="text-[11px] text-slate-400 font-mono">{t("esg.subtitle")}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-slate-500 font-mono hidden md:inline">
              Generated {new Date(summary.generatedAt).toLocaleString()}
            </span>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {t("common.refresh")}
            </button>
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              {t("common.csv")}
            </button>
            <button
              onClick={handleExportJson}
              className="flex items-center gap-1.5 text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-2 rounded-lg transition-all"
            >
              <FileJson className="w-3.5 h-3.5" />
              {t("common.json")}
            </button>
            <button
              onClick={handleExportEsgXlsx}
              disabled={esgXlsxExporting}
              className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-3 py-2 rounded-lg transition-all whitespace-nowrap"
              title="Export manufacturer, grade, PPWR target, and readiness-index data sheets as an Excel workbook"
            >
              {esgXlsxExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5" />
              )}
              {esgXlsxExporting ? t("common.generating") : t("esg.button.exportDataSheets")}
            </button>
            <button
              onClick={handleExportPdf}
              disabled={pdfExporting}
              className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold px-3 py-2 rounded-lg transition-all whitespace-nowrap"
              title="Generate the EU ESPR 2026 portfolio compliance report"
            >
              {pdfExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )}
              {pdfExporting ? t("common.generating") : t("esg.button.exportCompliancePdf")}
            </button>
          </div>
        </div>
        {(pdfError || esgXlsxError) && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 -mt-1 space-y-1.5">
            {pdfError && (
              <div className="flex items-start gap-1.5 text-[11px] text-red-400 font-mono bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{pdfError}</span>
              </div>
            )}
            {esgXlsxError && (
              <div className="flex items-start gap-1.5 text-[11px] text-red-400 font-mono bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{esgXlsxError}</span>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard
            icon={Recycle}
            label={t("esg.kpi.pcrMass")}
            value={numberFmt(summary.pcrMass.pcrMassKg)}
            unit="kg"
            accent="text-emerald-400"
            sub={
              <>
                {numberFmt(summary.pcrMass.pcrMassKg / 1000, 2)} tonnes · {summary.pcrMass.pcrAdoptionRatePercent}%
                adoption of weighed mass
              </>
            }
          />
          <KpiCard
            icon={Leaf}
            label={t("esg.kpi.carbonFootprint")}
            value={summary.carbon.totalVerifiedKgCO2e !== null ? numberFmt(summary.carbon.totalVerifiedKgCO2e) : "—"}
            unit={summary.carbon.totalVerifiedKgCO2e !== null ? "kg CO2e" : undefined}
            accent="text-teal-400"
            sub={
              <>
                Illustrative estimate:{" "}
                {summary.carbon.totalIllustrativeEstimateKgCO2e !== null
                  ? `${numberFmt(summary.carbon.totalIllustrativeEstimateKgCO2e)} kg CO2e`
                  : "n/a"}
              </>
            }
          />
          <KpiCard
            icon={TrendingUp}
            label={t("esg.kpi.taxRelief")}
            value={`€${numberFmt(summary.taxRelief.estimatedReliefEur, 0)}`}
            accent="text-amber-400"
            sub={<>€{summary.taxRelief.ratePerTonneEur}/tonne on {numberFmt(summary.taxRelief.pcrMassTonnes, 2)} t PCR — illustrative only</>}
          />
          <KpiCard
            icon={BadgeCheck}
            label={t("esg.kpi.certCompliance")}
            value={`${summary.compliance.verifiedPercent}%`}
            accent="text-blue-400"
            sub={
              <>
                {summary.compliance.verified} verified / {summary.compliance.totalCertifications} total
              </>
            }
          />
        </div>

        {/* Phase 5 — Sustainability Readiness Index. A composite 0-100
            score built from 5 already-shown figures (see
            lib/services/esg-analytics.ts's computeReadinessIndex) —
            rendered as a ring + a fully transparent component breakdown,
            never just a bare number, so a viewer can see exactly what
            moved it. */}
        <ReadinessIndexSection readinessIndex={summary.readinessIndex} totalBatches={summary.totalBatches} />

        {/* Phase 5 — PPWR regulatory target comparison. */}
        <RegulatoryComplianceSection regulatoryCompliance={summary.regulatoryCompliance} />

        {/* Trend charts — two single-axis charts, never one dual-axis chart
            (PCR % and kg CO2e/kg are different units/scales). */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-emerald-400" /> PCR Adoption Trend
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">Avg. recycled content % by production month</p>
              </div>
            </div>
            {pcrTrendData.length === 0 ? (
              <EmptyChartState />
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={pcrTrendData}>
                    <defs>
                      <linearGradient id="esgPcrColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} unit="%" />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#090d16", borderColor: "#1e293b", borderRadius: "12px", fontSize: "12px" }}
                      formatter={(value: number) => [`${value}%`, "Avg PCR"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="avgPcr"
                      stroke="#10b981"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#esgPcrColor)"
                      name="Avg PCR %"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Leaf className="w-4 h-4 text-teal-400" /> Verified Carbon Intensity Trend
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">Avg. kg CO2e/kg by production month</p>
              </div>
            </div>
            {carbonTrendData.length === 0 ? (
              <EmptyChartState />
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={carbonTrendData}>
                    <defs>
                      <linearGradient id="esgCarbonColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#090d16", borderColor: "#1e293b", borderRadius: "12px", fontSize: "12px" }}
                      formatter={(value: number) => [`${value} kg CO2e/kg`, "Avg Intensity"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="avgCarbon"
                      stroke="#14b8a6"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#esgCarbonColor)"
                      name="Avg Carbon Intensity"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Compliance breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5 mb-1">
              <BadgeCheck className="w-4 h-4 text-blue-400" /> Certification Verification Status
            </h3>
            <p className="text-[11px] text-slate-400 font-mono mb-4">
              {summary.compliance.totalCertifications} certifications across {summary.activeBatches} active batches
            </p>
            <StackedStatusBar
              segments={[
                {
                  label: "Verified",
                  count: summary.compliance.verified,
                  percent: summary.compliance.verifiedPercent,
                  barColorClass: "bg-emerald-500",
                  textColorClass: "text-emerald-400",
                  icon: CheckCircle2,
                },
                {
                  label: "Pending Review",
                  count: summary.compliance.pendingReview,
                  percent: summary.compliance.pendingReviewPercent,
                  barColorClass: "bg-amber-500",
                  textColorClass: "text-amber-400",
                  icon: Clock,
                },
                {
                  label: "Rejected",
                  count: summary.compliance.rejected,
                  percent: summary.compliance.rejectedPercent,
                  barColorClass: "bg-red-500",
                  textColorClass: "text-red-400",
                  icon: AlertTriangle,
                },
              ]}
            />
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5 mb-1">
              <Clock className="w-4 h-4 text-blue-400" /> Verified Certificate Expiry
            </h3>
            <p className="text-[11px] text-slate-400 font-mono mb-4">
              Computed live from validUntil — never a stored status (see certification-status.ts)
            </p>
            <StackedStatusBar
              segments={[
                {
                  label: "Currently Valid",
                  count: summary.compliance.verifiedCurrentlyValid,
                  percent: pct(summary.compliance.verifiedCurrentlyValid, summary.compliance.verified),
                  barColorClass: "bg-emerald-500",
                  textColorClass: "text-emerald-400",
                  icon: CheckCircle2,
                },
                {
                  label: "Expiring Soon",
                  count: summary.compliance.verifiedExpiringSoon,
                  percent: pct(summary.compliance.verifiedExpiringSoon, summary.compliance.verified),
                  barColorClass: "bg-amber-500",
                  textColorClass: "text-amber-400",
                  icon: Clock,
                },
                {
                  label: "Expired",
                  count: summary.compliance.verifiedExpired,
                  percent: pct(summary.compliance.verifiedExpired, summary.compliance.verified),
                  barColorClass: "bg-red-500",
                  textColorClass: "text-red-400",
                  icon: AlertTriangle,
                },
              ]}
            />
          </div>
        </div>

        {/* Batches by status + monthly trend table */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5 mb-4">
              <Layers className="w-4 h-4 text-purple-400" /> Batches by Status
            </h3>
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800">
                  <th className="py-2">{t("common.status")}</th>
                  <th className="py-2 text-right">{t("greenAccounting.table.count")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {Object.entries(summary.statusBreakdown).map(([status, count]) => (
                  <tr key={status}>
                    <td className="py-2 text-slate-300">{STATUS_LABELS[status] ?? status}</td>
                    <td className="py-2 text-right text-white font-bold">{count}</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-800">
                  <td className="py-2 text-slate-500">Total</td>
                  <td className="py-2 text-right text-emerald-400 font-bold">{summary.totalBatches}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl overflow-x-auto">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5 mb-4">
              <Gauge className="w-4 h-4 text-purple-400" /> Monthly Trend (data table)
            </h3>
            {summary.monthlyTrend.length === 0 ? (
              <EmptyChartState />
            ) : (
              <table className="w-full text-left font-mono text-xs min-w-[420px]">
                <thead>
                  <tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800">
                    <th className="py-2">{t("greenAccounting.table.month")}</th>
                    <th className="py-2 text-right">{t("greenAccounting.table.batches")}</th>
                    <th className="py-2 text-right">{t("greenAccounting.table.avgPcr")}</th>
                    <th className="py-2 text-right">{t("greenAccounting.table.avgCarbon")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {summary.monthlyTrend.map((p) => (
                    <tr key={p.month}>
                      <td className="py-2 text-slate-300">{p.month}</td>
                      <td className="py-2 text-right text-white">{p.batchCount}</td>
                      <td className="py-2 text-right text-emerald-400">{p.avgRecycledContentPercent}%</td>
                      <td className="py-2 text-right text-teal-400">{p.avgVerifiedCarbonIntensityKgCO2ePerKg}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Phase 5 — Manufacturer distribution + Material grade distribution. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ManufacturerDistributionCard manufacturers={summary.manufacturerDistribution} />
          <GradeDistributionCard grades={summary.gradeDistribution} />
        </div>

        {/* Green Accounting & Plastic Tax widget (Sprint 3.1) — a compact
            summary of lib/services/plastic-tax-calculator.ts's portfolio
            figures, computed server-side alongside this page's own ESG
            summary (see app/admin/esg-analytics/page.tsx) so the two never
            disagree. Full detail — per-batch breakdown, locking a
            valuation, tax-parameter configuration — lives on the
            dedicated /admin/green-accounting page this links to. */}
        {greenAccounting && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-lime-400" /> Green Accounting &amp; Plastic Tax
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  {greenAccounting.ratePerTonneEur} EUR/t · {greenAccounting.jurisdiction} ·{" "}
                  {greenAccounting.batchesWithWeightData} of {greenAccounting.activeBatches} active batches valued
                </p>
              </div>
              <Link
                href="/admin/green-accounting"
                className="flex items-center gap-1.5 text-xs bg-lime-500/10 hover:bg-lime-500/20 border border-lime-500/30 text-lime-400 px-3 py-2 rounded-lg transition-all whitespace-nowrap"
              >
                View Full Green Accounting
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{t("greenAccounting.kpi.grossLiability")}</div>
                <div className="text-xl font-extrabold font-mono mt-1 text-amber-400">
                  €{numberFmt(greenAccounting.totalGrossLiabilityEur, 0)}
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{t("greenAccounting.kpi.pcrTaxSavings")}</div>
                <div className="text-xl font-extrabold font-mono mt-1 text-emerald-400">
                  €{numberFmt(greenAccounting.totalPcrTaxSavingsEur, 0)}
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  {t("greenAccounting.kpi.netLiability")}
                  <Lock className="w-2.5 h-2.5 text-slate-600" />
                </div>
                <div className="text-xl font-extrabold font-mono mt-1 text-rose-400">
                  €{numberFmt(greenAccounting.totalNetLiabilityEur, 0)}
                </div>
              </div>
            </div>

            {/* Sprint 3.2 export buttons — same routes/logic as the
                dedicated /admin/green-accounting page's header buttons,
                compact form for this widget's tighter footprint. */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <button
                onClick={handleExportGreenXlsx}
                disabled={greenXlsxExporting}
                className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-3 py-2 rounded-lg transition-all whitespace-nowrap"
              >
                {greenXlsxExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                )}
                {t("greenAccounting.button.exportExcel")}
              </button>
              <button
                onClick={handleExportGreenPdf}
                disabled={greenPdfExporting}
                className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold px-3 py-2 rounded-lg transition-all whitespace-nowrap"
              >
                {greenPdfExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                {t("greenAccounting.button.exportPdf")}
              </button>
            </div>
            {(greenPdfError || greenXlsxError) && (
              <div className="mt-2 space-y-1.5">
                {greenPdfError && (
                  <div className="flex items-start gap-1.5 text-[11px] text-red-400 font-mono bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{greenPdfError}</span>
                  </div>
                )}
                {greenXlsxError && (
                  <div className="flex items-start gap-1.5 text-[11px] text-red-400 font-mono bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{greenXlsxError}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Caveats footer — mirrors the "never present unverified/estimated
            data as fact" principle used throughout this app (certifications,
            carbon calculator, public scan page). */}
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-5 flex items-start gap-3 text-[11px] font-mono text-slate-400">
          <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p>
              <span className="text-slate-300 font-semibold">Mass-based metrics</span> (PCR mass, tax relief, verified
              carbon totals) are computed only over batches with a recorded weight —{" "}
              {summary.pcrMass.batchesWithWeightData} of {summary.pcrMass.batchesConsidered} active batches
              qualify ({summary.pcrMass.batchesMissingWeightData} excluded, no weight on record).
            </p>
            <p>
              <span className="text-slate-300 font-semibold">Illustrative carbon estimate</span> uses placeholder
              emission factors, not a licensed database — always shown separately from the manufacturer&apos;s own
              verified LCA figure, never blended into one number.
            </p>
            <p>
              <span className="text-slate-300 font-semibold">Tax relief figure</span> is illustrative only, not tax
              or legal advice. {summary.taxRelief.disclaimer}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function EmptyChartState() {
  return (
    <div className="h-56 flex items-center justify-center text-xs text-slate-500 font-mono text-center px-6">
      No production-dated batches yet — this fills in as passports are issued.
    </div>
  );
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 10000) / 100 : 0;
}

// ----------------------------------------------------------------------------
// Phase 5 (Advanced ESG & Carbon Analytics Dashboard) additions
// ----------------------------------------------------------------------------

// Rating → color mapping used by both the gauge stroke (a raw SVG
// attribute, not a Tailwind class, so an inline hex is correct here — not
// the "always pass literal Tailwind class strings" JIT concern that
// applies to barColorClass/textColorClass above) and the rating badge.
const RATING_META: Record<
  EsgReadinessIndexRating,
  { hex: string; badgeClass: string; icon: typeof Award }
> = {
  Leading: { hex: "#10b981", badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", icon: Award },
  Advancing: { hex: "#14b8a6", badgeClass: "bg-teal-500/10 text-teal-400 border-teal-500/30", icon: TrendingUp },
  Developing: { hex: "#f59e0b", badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30", icon: Clock },
  "Early Stage": { hex: "#f43f5e", badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/30", icon: AlertTriangle },
};

type EsgReadinessIndexRating = "Leading" | "Advancing" | "Developing" | "Early Stage";

function ReadinessGauge({ score, hex }: { score: number; hex: string }) {
  const size = 140;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={hex}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold font-mono text-white">{score}</span>
        <span className="text-[10px] text-slate-500 font-mono">/ 100</span>
      </div>
    </div>
  );
}

function ReadinessIndexSection({
  readinessIndex,
  totalBatches,
}: {
  readinessIndex: EsgAnalyticsSummary["readinessIndex"];
  totalBatches: number;
}) {
  const meta = RATING_META[readinessIndex.rating];
  const RatingIcon = meta.icon;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
          <Award className="w-4 h-4 text-amber-400" /> Sustainability Readiness Index
        </h3>
        <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 border rounded-full font-semibold ${meta.badgeClass}`}>
          <RatingIcon className="w-3 h-3" />
          {readinessIndex.rating}
        </span>
      </div>

      {totalBatches === 0 ? (
        <EmptyChartState />
      ) : (
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          <ReadinessGauge score={readinessIndex.overallScore} hex={meta.hex} />
          <div className="flex-1 w-full space-y-3">
            {readinessIndex.components.map((c: EsgReadinessComponent) => (
              <div key={c.key}>
                <div className="flex items-center justify-between gap-2 text-[11px] mb-1">
                  <span className="text-slate-300 font-semibold">{c.label}</span>
                  <span className="text-slate-500 font-mono shrink-0">
                    {c.score}/100 · {Math.round(c.weight * 100)}% weight
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, Math.max(0, c.score))}%`, backgroundColor: meta.hex }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 font-mono mt-1">{c.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-[10px] text-slate-500 font-mono mt-4 pt-4 border-t border-slate-800/60">
        {readinessIndex.methodologyNote}
      </p>
    </div>
  );
}

function RegulatoryComplianceSection({
  regulatoryCompliance,
}: {
  regulatoryCompliance: EsgAnalyticsSummary["regulatoryCompliance"];
}) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
      <h3 className="text-sm font-bold text-white flex items-center gap-1.5 mb-1">
        <Target className="w-4 h-4 text-cyan-400" /> PPWR Regulatory Target Compliance
      </h3>
      <p className="text-[11px] text-slate-400 font-mono mb-4">
        Mass-weighted PCR adoption vs. the EU Packaging &amp; Packaging Waste Regulation baseline target
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {regulatoryCompliance.targets.map((t) => {
          const barPercent = Math.min(100, t.actualPercent);
          const targetMarkerPercent = Math.min(100, t.targetPercent);
          return (
            <div key={t.year} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white">{t.year} Target</span>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 border rounded-full font-semibold ${
                    t.onTrack
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                  }`}
                >
                  {t.onTrack ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  {t.onTrack ? "On Track" : "Below Target"}
                </span>
              </div>
              <div className="relative w-full h-3 rounded-full bg-slate-900 overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full ${t.onTrack ? "bg-emerald-500" : "bg-amber-500"}`}
                  style={{ width: `${barPercent}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-100"
                  style={{ left: `${targetMarkerPercent}%` }}
                  title={`${t.targetPercent}% target`}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">
                  Actual <span className="text-white font-bold">{t.actualPercent}%</span>
                </span>
                <span className="text-slate-400">
                  Target <span className="text-slate-200 font-bold">{t.targetPercent}%</span>
                </span>
                <span className={t.gapPercentagePoints >= 0 ? "text-emerald-400" : "text-amber-400"}>
                  {t.gapPercentagePoints >= 0 ? "+" : ""}
                  {t.gapPercentagePoints}pp
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-500 font-mono mt-4 pt-4 border-t border-slate-800/60">
        {regulatoryCompliance.disclaimer}
      </p>
    </div>
  );
}

function ManufacturerDistributionCard({
  manufacturers,
}: {
  manufacturers: EsgAnalyticsSummary["manufacturerDistribution"];
}) {
  const { t } = useLanguage();
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
      <h3 className="text-sm font-bold text-white flex items-center gap-1.5 mb-1">
        <Factory className="w-4 h-4 text-indigo-400" /> Manufacturer Distribution
      </h3>
      <p className="text-[11px] text-slate-400 font-mono mb-4">{manufacturers.length} manufacturer bucket(s) across active batches</p>
      {manufacturers.length === 0 ? (
        <EmptyChartState />
      ) : (
        <div className="max-h-72 overflow-y-auto overflow-x-auto -mx-1 px-1">
          <table className="w-full text-left font-mono text-xs min-w-[480px]">
            <thead className="sticky top-0 bg-slate-900">
              <tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800">
                <th className="py-2">{t("esg.table.manufacturer")}</th>
                <th className="py-2 text-right">{t("greenAccounting.table.batches")}</th>
                <th className="py-2 text-right">{t("greenAccounting.table.avgPcr")}</th>
                <th className="py-2 text-right">{t("esg.table.avgCarbon")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {manufacturers.map((m) => (
                <tr key={m.manufacturerId ?? "unassigned"}>
                  <td className="py-2 text-slate-300">
                    <div className="text-slate-200">{m.manufacturerName}</div>
                    {m.country && <div className="text-[10px] text-slate-500">{m.country}</div>}
                  </td>
                  <td className="py-2 text-right text-white">
                    {m.batchCount} <span className="text-slate-500">({m.batchCountPercent}%)</span>
                  </td>
                  <td className="py-2 text-right text-emerald-400">{m.avgRecycledContentPercent}%</td>
                  <td className="py-2 text-right text-teal-400">
                    {m.avgVerifiedCarbonIntensityKgCO2ePerKg !== null ? m.avgVerifiedCarbonIntensityKgCO2ePerKg : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GradeDistributionCard({ grades }: { grades: EsgAnalyticsSummary["gradeDistribution"] }) {
  const { t } = useLanguage();
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
      <h3 className="text-sm font-bold text-white flex items-center gap-1.5 mb-1">
        <Boxes className="w-4 h-4 text-fuchsia-400" /> Material Grade Distribution
      </h3>
      <p className="text-[11px] text-slate-400 font-mono mb-4">{grades.length} distinct polymer/grade combination(s)</p>
      {grades.length === 0 ? (
        <EmptyChartState />
      ) : (
        <div className="max-h-72 overflow-y-auto overflow-x-auto -mx-1 px-1">
          <table className="w-full text-left font-mono text-xs min-w-[420px]">
            <thead className="sticky top-0 bg-slate-900">
              <tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800">
                <th className="py-2">{t("esg.table.polymerGrade")}</th>
                <th className="py-2 text-right">{t("greenAccounting.table.batches")}</th>
                <th className="py-2 text-right">{t("greenAccounting.table.avgPcr")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {grades.map((g) => (
                <tr key={`${g.polymerType}::${g.grade}`}>
                  <td className="py-2 text-slate-300">
                    <div className="text-slate-200">{g.grade}</div>
                    <div className="text-[10px] text-slate-500">{g.polymerType}</div>
                  </td>
                  <td className="py-2 text-right text-white">
                    {g.batchCount} <span className="text-slate-500">({g.batchCountPercent}%)</span>
                  </td>
                  <td className="py-2 text-right text-emerald-400">{g.avgRecycledContentPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
