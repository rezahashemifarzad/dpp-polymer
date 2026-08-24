"use client";

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
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  Gauge,
  Info,
} from "lucide-react";
import type { EsgAnalyticsSummary } from "@/lib/services/esg-analytics";

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
  lines.push(`Disclaimer,${csvEscape(summary.taxRelief.disclaimer)}`);
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

export function EsgAnalyticsDashboard({ summary }: { summary: EsgAnalyticsSummary }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

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

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans overflow-x-hidden">
      {/* Header — was a fixed h-16 row with a back-link+title block and a
          timestamp+3-button block crammed side by side; at phone widths the
          two blocks together are wider than the viewport. min-h-16 + flex-wrap
          (instead of a fixed height + no-wrap) lets the button block drop to
          its own line instead of forcing horizontal overflow, and the button
          block itself also wraps as a safety net for in-between widths. */}
      <header className="border-b border-slate-800/80 bg-[#070c18]/90 backdrop-blur-2xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-16 py-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/admin"
              className="shrink-0 flex items-center gap-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-2 rounded-lg transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Admin Console
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white tracking-tight">Corporate ESG Analytics</h1>
              <p className="text-[11px] text-slate-400 font-mono">Sustainability &amp; Circular Economy Summary</p>
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
              Refresh
            </button>
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
            <button
              onClick={handleExportJson}
              className="flex items-center gap-1.5 text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-2 rounded-lg transition-all"
            >
              <FileJson className="w-3.5 h-3.5" />
              JSON
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard
            icon={Recycle}
            label="PCR Mass Consumed"
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
            label="Carbon Footprint (Verified)"
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
            label="Est. EU Plastic Tax Relief"
            value={`€${numberFmt(summary.taxRelief.estimatedReliefEur, 0)}`}
            accent="text-amber-400"
            sub={<>€{summary.taxRelief.ratePerTonneEur}/tonne on {numberFmt(summary.taxRelief.pcrMassTonnes, 2)} t PCR — illustrative only</>}
          />
          <KpiCard
            icon={BadgeCheck}
            label="Certification Compliance"
            value={`${summary.compliance.verifiedPercent}%`}
            accent="text-blue-400"
            sub={
              <>
                {summary.compliance.verified} verified / {summary.compliance.totalCertifications} total
              </>
            }
          />
        </div>

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
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Count</th>
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
                    <th className="py-2">Month</th>
                    <th className="py-2 text-right">Batches</th>
                    <th className="py-2 text-right">Avg PCR %</th>
                    <th className="py-2 text-right">Avg Carbon (kg/kg)</th>
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
