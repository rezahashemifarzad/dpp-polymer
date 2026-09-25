"use client";

// FIX (round 4 — language selector didn't translate admin pages): this
// dashboard's own header (title + subtitle) translated via
// lib/i18n/app-dictionary.ts — see that file's banner for scope.
import { useLanguage } from "@/lib/hooks/use-language";

/**
 * components/dashboard/green-accounting-dashboard.tsx
 * -----------------------------------------------------------------------
 * Green Accounting & EU Plastic Tax Tracker — dedicated dashboard.
 * Renders the summary computed server-side by
 * lib/services/plastic-tax-calculator.ts (see
 * app/admin/green-accounting/page.tsx, a Server Component that fetches
 * once and passes both the portfolio summary and the tax-parameter list
 * down as props) — same "server fetches, client only renders + exports"
 * split as components/dashboard/esg-analytics-dashboard.tsx.
 *
 * Two mutating actions, both Server Actions (never a client-side fetch to
 * the RBAC'd REST routes — those exist for external callers, see
 * app/api/green-accounting/*): locking a batch's live figures into a
 * BatchGreenValuation snapshot (lib/actions/save-green-valuation.ts), and
 * adding a new PlasticTaxParameter rate (lib/actions/
 * upsert-tax-parameter.ts). Both call router.refresh() on success so the
 * server-computed summary this page shows never drifts from what was
 * just written.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  ArrowLeft,
  RefreshCw,
  Download,
  FileJson,
  Coins,
  Recycle,
  TrendingDown,
  TrendingUp,
  Gauge,
  Lock,
  Loader2,
  Info,
  Plus,
  AlertTriangle,
  Layers,
  FileText,
  FileSpreadsheet,
  Activity,
  CalendarRange,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import type {
  PortfolioGreenAccountingSummary,
  TaxParameterSummary,
  CreateTaxParameterInput,
} from "@/lib/services/plastic-tax-calculator";
import type { GreenTaxTrendForecastSummary } from "@/lib/services/green-tax-trend-forecast";
import { saveGreenValuationAction } from "@/lib/actions/save-green-valuation";
import { upsertTaxParameterAction } from "@/lib/actions/upsert-tax-parameter";

const numberFmt = (n: number, maxFractionDigits = 1) =>
  n.toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });
const eurFmt = (n: number) =>
  `€${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

// Server-rendered exports (PDF/Excel) — unlike CSV/JSON above (built
// entirely client-side from the `summary` prop already in hand), these
// need a real fetch+blob round trip against the routes backing
// lib/services/generate-green-tax-report-pdf.tsx and
// generateGreenTaxWorkbook() (see lib/services/generate-ledger-workbook.ts)
// — same pattern esg-analytics-dashboard.tsx's own PDF export uses.
async function downloadFromRoute(url: string, filenameFallback: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error || `Request failed with status ${res.status}`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filenameFallback;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

function buildCsv(summary: PortfolioGreenAccountingSummary): string {
  const lines: string[] = [];
  lines.push("Green Accounting & EU Plastic Tax Summary");
  lines.push(`Generated At,${csvEscape(summary.generatedAt)}`);
  lines.push(`Jurisdiction,${csvEscape(summary.jurisdiction)}`);
  lines.push(`Rate,${summary.ratePerTonneEur},EUR/tonne`);
  lines.push("");
  lines.push("Metric,Value,Unit");
  lines.push(`Active Batches,${summary.activeBatches},count`);
  lines.push(`Batches With Weight Data,${summary.batchesWithWeightData},count`);
  lines.push(`Batches Missing Weight Data,${summary.batchesMissingWeightData},count`);
  lines.push(`Total Mass,${summary.totalMassKg},kg`);
  lines.push(`Total PCR Mass,${summary.totalPcrMassKg},kg`);
  lines.push(`Total Taxable Mass,${summary.totalTaxableMassKg},kg`);
  lines.push(`Gross Liability,${summary.totalGrossLiabilityEur},EUR`);
  lines.push(`PCR Tax Savings,${summary.totalPcrTaxSavingsEur},EUR`);
  lines.push(`Net Liability,${summary.totalNetLiabilityEur},EUR`);
  lines.push("");
  lines.push("Per-Batch Breakdown");
  lines.push(
    "Batch ID,Polymer,Grade,Manufacturer,Status,Mass (kg),PCR Mass (kg),Taxable Mass (kg),Gross (EUR),Savings (EUR),Net (EUR),Locked Valuation"
  );
  for (const b of summary.batches) {
    lines.push(
      [
        csvEscape(b.batchId),
        csvEscape(b.polymerType),
        csvEscape(b.grade),
        csvEscape(b.manufacturerName ?? "—"),
        csvEscape(b.status),
        b.batchMassKg,
        b.pcrMassKg,
        b.taxableMassKg,
        b.grossLiabilityEur,
        b.pcrTaxSavingsEur,
        b.netLiabilityEur,
        b.hasLockedValuation ? "Yes" : "No",
      ].join(",")
    );
  }
  lines.push("");
  lines.push(`Disclaimer,${csvEscape(summary.disclaimer)}`);
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
  icon: typeof Coins;
  label: string;
  value: string;
  unit?: string;
  accent: string;
  sub?: React.ReactNode;
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

function TaxParameterPanel({ taxParameters }: { taxParameters: TaxParameterSummary[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateTaxParameterInput>({
    jurisdiction: "EU",
    label: "EU Plastic Packaging Tax",
    currency: "EUR",
    ratePerTonne: 800,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    // Final Polish & Stability Sprint: wrapped in try/catch/finally — a
    // Server Action call can reject outright (a dropped connection, not
    // just the action's own handled `ok:false` result), and without this
    // the button was left stuck showing "Saving..." forever with no error
    // surfaced, since setSaving(false) was only ever reached on the
    // success path below it.
    try {
      const result = await upsertTaxParameterAction(form);
      if (!result.ok) {
        setError(result.error ?? "Failed to save tax parameter");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save tax parameter");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <Gauge className="w-4 h-4 text-lime-400" /> Tax Parameters
          </h3>
          <p className="text-[11px] text-slate-400 font-mono">Configurable, versioned rate per tonne by jurisdiction</p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-xs bg-lime-500 hover:bg-lime-400 text-slate-950 font-bold px-3 py-2 rounded-lg transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          New Rate
        </button>
      </div>

      {open && (
        <div className="mb-4 p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="text-[10px] text-slate-500 font-mono uppercase">
              Jurisdiction
              <input
                value={form.jurisdiction ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, jurisdiction: e.target.value }))}
                className="mt-1 w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-lime-500/50"
              />
            </label>
            <label className="text-[10px] text-slate-500 font-mono uppercase">
              Currency
              <input
                value={form.currency ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="mt-1 w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-lime-500/50"
              />
            </label>
            <label className="text-[10px] text-slate-500 font-mono uppercase col-span-2">
              Rate (per tonne)
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.ratePerTonne}
                onChange={(e) => setForm((f) => ({ ...f, ratePerTonne: Number(e.target.value) }))}
                className="mt-1 w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-lime-500/50"
              />
            </label>
            <label className="text-[10px] text-slate-500 font-mono uppercase col-span-2 md:col-span-4">
              Label
              <input
                value={form.label ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                className="mt-1 w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-lime-500/50"
              />
            </label>
            <label className="text-[10px] text-slate-500 font-mono uppercase col-span-2 md:col-span-4">
              Source / Notes (optional)
              <input
                value={form.source ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                className="mt-1 w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-lime-500/50"
              />
            </label>
          </div>
          {error && (
            <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-mono">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}
          <button
            onClick={submit}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold px-3 py-2 rounded-lg transition-all"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Coins className="w-3.5 h-3.5" />}
            Save Rate
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-xs min-w-[520px]">
          <thead>
            <tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800">
              <th className="py-2 pr-4">Jurisdiction</th>
              <th className="py-2 pr-4">Label</th>
              <th className="py-2 pr-4 text-right">Rate</th>
              <th className="py-2 pr-4">Effective From</th>
              <th className="py-2">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {taxParameters.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-center text-slate-500">
                  No configured rates yet — the built-in default (€800/tonne, EU) is used until one is added.
                </td>
              </tr>
            ) : (
              taxParameters.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 pr-4 text-slate-300">{p.jurisdiction}</td>
                  <td className="py-2 pr-4 text-slate-300">{p.label}</td>
                  <td className="py-2 pr-4 text-right text-white font-bold whitespace-nowrap">
                    {p.currency} {numberFmt(p.ratePerTonne, 2)}
                  </td>
                  <td className="py-2 pr-4 text-slate-400 whitespace-nowrap">{new Date(p.effectiveFrom).toLocaleDateString()}</td>
                  <td className="py-2">
                    {p.active ? (
                      <span className="text-emerald-400">Active</span>
                    ) : (
                      <span className="text-slate-600">Retired</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BatchRow({
  batch,
  onLocked,
}: {
  batch: PortfolioGreenAccountingSummary["batches"][number];
  onLocked: () => void;
}) {
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLock = async () => {
    setLocking(true);
    setError(null);
    // Same try/catch/finally fix as TaxParameterPanel's submit() above —
    // an outright Server Action rejection must not leave the Lock button
    // stuck spinning with no feedback.
    try {
      const result = await saveGreenValuationAction(batch.batchId);
      if (!result.ok) {
        setError(result.error ?? "Failed to lock valuation");
        return;
      }
      onLocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to lock valuation");
    } finally {
      setLocking(false);
    }
  };

  return (
    <tr>
      <td className="py-2 pr-4 text-slate-300 whitespace-nowrap">{batch.batchId}</td>
      <td className="py-2 pr-4 text-slate-400 whitespace-nowrap">{batch.manufacturerName ?? "—"}</td>
      <td className="py-2 pr-4 text-right text-white whitespace-nowrap">{batch.hasWeightData ? numberFmt(batch.batchMassKg) : "—"}</td>
      <td className="py-2 pr-4 text-right text-emerald-400 whitespace-nowrap">{batch.hasWeightData ? numberFmt(batch.pcrMassKg) : "—"}</td>
      <td className="py-2 pr-4 text-right text-amber-400 whitespace-nowrap">{eurFmt(batch.grossLiabilityEur)}</td>
      <td className="py-2 pr-4 text-right text-emerald-400 whitespace-nowrap">{eurFmt(batch.pcrTaxSavingsEur)}</td>
      <td className="py-2 pr-4 text-right text-white font-bold whitespace-nowrap">{eurFmt(batch.netLiabilityEur)}</td>
      <td className="py-2 text-right">
        {!batch.hasWeightData ? (
          <span className="text-[10px] text-slate-600">no weight data</span>
        ) : batch.hasLockedValuation ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-lime-400">
            <Lock className="w-3 h-3" /> Locked
          </span>
        ) : (
          <button
            onClick={handleLock}
            disabled={locking}
            className="inline-flex items-center gap-1 text-[10px] bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 px-2 py-1 rounded-md transition-all"
          >
            {locking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
            Lock
          </button>
        )}
        {error && <div className="text-[9px] text-rose-400 mt-1">{error}</div>}
      </td>
    </tr>
  );
}

function TrendEmptyState({ quartersAvailable, minQuartersRequired }: { quartersAvailable: number; minQuartersRequired: number }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
      <h3 className="text-sm font-bold text-white flex items-center gap-1.5 mb-1">
        <Activity className="w-4 h-4 text-lime-400" /> Tax Liability Trend &amp; Forecast
      </h3>
      <div className="h-40 flex items-center justify-center text-xs text-slate-500 font-mono text-center px-6">
        Not enough production history yet to forecast a trend — {quartersAvailable} of {minQuartersRequired} minimum
        quarters with recorded batch weight available. This fills in automatically as more weighed batches are
        produced across additional quarters.
      </div>
    </div>
  );
}

function TrendForecastSection({ trendForecast }: { trendForecast: GreenTaxTrendForecastSummary }) {
  const lastActualIdx = useMemo(
    () => trendForecast.quarterly.reduce((acc, q, i) => (!q.isForecast ? i : acc), -1),
    [trendForecast.quarterly]
  );
  const forecastStartQuarter =
    lastActualIdx >= 0 && lastActualIdx + 1 < trendForecast.quarterly.length
      ? trendForecast.quarterly[lastActualIdx + 1].quarter
      : null;

  // Two independent single-axis series (both EUR, but kept as separate
  // charts rather than one dual-metric chart to match this app's
  // established "never force two differently-shaped trends onto one
  // chart" convention from esg-analytics-dashboard.tsx). Each chart's
  // data has an "actual" key (undefined for forecast points) and a
  // "forecast" key (undefined for actual points, except at the join
  // index which carries both — that's what makes the dashed forecast
  // line visually continue from where the solid actual line ends,
  // instead of leaving a gap).
  const netChartData = useMemo(
    () =>
      trendForecast.quarterly.map((q, i) => ({
        quarter: q.quarter,
        actual: !q.isForecast ? q.netLiabilityEur : undefined,
        forecast: q.isForecast || i === lastActualIdx ? q.netLiabilityEur : undefined,
      })),
    [trendForecast.quarterly, lastActualIdx]
  );
  const savingsChartData = useMemo(
    () =>
      trendForecast.quarterly.map((q, i) => ({
        quarter: q.quarter,
        actual: !q.isForecast ? q.pcrTaxSavingsEur : undefined,
        forecast: q.isForecast || i === lastActualIdx ? q.pcrTaxSavingsEur : undefined,
      })),
    [trendForecast.quarterly, lastActualIdx]
  );

  if (!trendForecast.hasSufficientData) {
    return (
      <TrendEmptyState
        quartersAvailable={trendForecast.quartersAvailable}
        minQuartersRequired={trendForecast.minQuartersRequired}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Forecast KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard
          icon={CalendarRange}
          label="Next Quarter Forecast (Net)"
          value={trendForecast.nextQuarterForecast ? eurFmt(trendForecast.nextQuarterForecast.netLiabilityEur) : "—"}
          accent="text-amber-400"
          sub={trendForecast.nextQuarterForecast ? <>{trendForecast.nextQuarterForecast.quarter}</> : undefined}
        />
        <KpiCard
          icon={TrendingUp}
          label="Next 12 Months Forecast (Net)"
          value={trendForecast.next12MonthsForecast ? eurFmt(trendForecast.next12MonthsForecast.netLiabilityEur) : "—"}
          accent="text-rose-400"
          sub={<>Rolling 4-quarter projection</>}
        />
        <KpiCard
          icon={Coins}
          label="Trailing Actual (Net)"
          value={trendForecast.trailingActual ? eurFmt(trendForecast.trailingActual.netLiabilityEur) : "—"}
          accent="text-slate-300"
          sub={trendForecast.trailingActual ? <>Last {trendForecast.trailingActual.quarterCount} actual quarters</> : undefined}
        />
        <KpiCard
          icon={
            trendForecast.projectedNetChangePercent === null
              ? Activity
              : trendForecast.projectedNetChangePercent < 0
                ? ArrowDownRight
                : ArrowUpRight
          }
          label="Projected Net Change"
          value={
            trendForecast.projectedNetChangePercent !== null
              ? `${trendForecast.projectedNetChangePercent > 0 ? "+" : ""}${trendForecast.projectedNetChangePercent}%`
              : "—"
          }
          accent={
            trendForecast.projectedNetChangePercent === null
              ? "text-slate-300"
              : trendForecast.projectedNetChangePercent < 0
                ? "text-emerald-400"
                : "text-rose-400"
          }
          sub={<>vs. trailing {trendForecast.trailingActual?.quarterCount ?? 0} actual quarters</>}
        />
      </div>

      {/* Trend charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-rose-400" /> Net Liability Trend &amp; Forecast
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              Actual by production quarter (solid) · projected next {trendForecast.next12MonthsForecast ? 4 : 0}{" "}
              quarters (dashed)
            </p>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={netChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="quarter" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `€${numberFmt(v, 0)}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#090d16", borderColor: "#1e293b", borderRadius: "12px", fontSize: "12px" }}
                  formatter={(value, name) => [eurFmt(Number(value)), name === "actual" ? "Actual" : "Forecast"]}
                />
                {forecastStartQuarter && (
                  <ReferenceLine
                    x={forecastStartQuarter}
                    stroke="#475569"
                    strokeDasharray="3 3"
                    label={{ value: "Forecast →", position: "insideTopRight", fill: "#94a3b8", fontSize: 10 }}
                  />
                )}
                <Line type="monotone" dataKey="actual" name="actual" stroke="#fb7185" strokeWidth={3} dot={{ r: 3 }} connectNulls={false} />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  name="forecast"
                  stroke="#fb7185"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ r: 3 }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Recycle className="w-4 h-4 text-emerald-400" /> PCR Tax Savings Trend &amp; Forecast
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              Actual by production quarter (solid) · projected next {trendForecast.next12MonthsForecast ? 4 : 0}{" "}
              quarters (dashed)
            </p>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={savingsChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="quarter" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `€${numberFmt(v, 0)}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#090d16", borderColor: "#1e293b", borderRadius: "12px", fontSize: "12px" }}
                  formatter={(value, name) => [eurFmt(Number(value)), name === "actual" ? "Actual" : "Forecast"]}
                />
                {forecastStartQuarter && (
                  <ReferenceLine
                    x={forecastStartQuarter}
                    stroke="#475569"
                    strokeDasharray="3 3"
                    label={{ value: "Forecast →", position: "insideTopRight", fill: "#94a3b8", fontSize: 10 }}
                  />
                )}
                <Line type="monotone" dataKey="actual" name="actual" stroke="#34d399" strokeWidth={3} dot={{ r: 3 }} connectNulls={false} />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  name="forecast"
                  stroke="#34d399"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ r: 3 }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quarterly + yearly data table (screen-reader-friendly, mirrors
          esg-analytics-dashboard.tsx's own "data table beneath the
          charts" convention). */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl overflow-x-auto">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5 mb-4">
            <CalendarRange className="w-4 h-4 text-purple-400" /> Quarterly Trend (data table)
          </h3>
          <table className="w-full text-left font-mono text-xs min-w-[420px]">
            <thead>
              <tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800">
                <th className="py-2">Quarter</th>
                <th className="py-2 text-right">Gross</th>
                <th className="py-2 text-right">Savings</th>
                <th className="py-2 text-right">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {trendForecast.quarterly.map((q) => (
                <tr key={q.quarter}>
                  <td className="py-2 text-slate-300">
                    {q.quarter}
                    {q.isForecast && <span className="ml-1.5 text-[9px] text-slate-500">(forecast)</span>}
                  </td>
                  <td className="py-2 text-right text-amber-400">{eurFmt(q.grossLiabilityEur)}</td>
                  <td className="py-2 text-right text-emerald-400">{eurFmt(q.pcrTaxSavingsEur)}</td>
                  <td className={`py-2 text-right ${q.isForecast ? "text-rose-300/70" : "text-rose-400"}`}>
                    {eurFmt(q.netLiabilityEur)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl overflow-x-auto">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5 mb-4">
            <Gauge className="w-4 h-4 text-purple-400" /> Yearly Rollup (data table)
          </h3>
          <table className="w-full text-left font-mono text-xs min-w-[420px]">
            <thead>
              <tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800">
                <th className="py-2">Year</th>
                <th className="py-2 text-right">Quarters</th>
                <th className="py-2 text-right">Gross</th>
                <th className="py-2 text-right">Savings</th>
                <th className="py-2 text-right">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {trendForecast.yearly.map((y) => (
                <tr key={y.label}>
                  <td className="py-2 text-slate-300">
                    {y.label}
                    {y.isForecast && <span className="ml-1.5 text-[9px] text-slate-500">(forecast)</span>}
                  </td>
                  <td className="py-2 text-right text-slate-400">{y.quarterCount}</td>
                  <td className="py-2 text-right text-amber-400">{eurFmt(y.grossLiabilityEur)}</td>
                  <td className="py-2 text-right text-emerald-400">{eurFmt(y.pcrTaxSavingsEur)}</td>
                  <td className={`py-2 text-right ${y.isForecast ? "text-rose-300/70" : "text-rose-400"}`}>
                    {eurFmt(y.netLiabilityEur)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-4 text-[11px] font-mono text-slate-400">
        <span className="text-slate-300 font-semibold">{trendForecast.disclaimer}</span>
      </div>
    </div>
  );
}

export function GreenAccountingDashboard({
  summary,
  taxParameters,
  trendForecast,
}: {
  summary: PortfolioGreenAccountingSummary;
  taxParameters: TaxParameterSummary[];
  trendForecast: GreenTaxTrendForecastSummary;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [xlsxExporting, setXlsxExporting] = useState(false);
  const [xlsxError, setXlsxError] = useState<string | null>(null);

  const dateStamp = summary.generatedAt.slice(0, 10);

  const handleRefresh = () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleExportJson = () => {
    downloadBlob(`green-accounting-${dateStamp}.json`, JSON.stringify(summary, null, 2), "application/json");
  };
  const handleExportCsv = () => {
    downloadBlob(`green-accounting-${dateStamp}.csv`, buildCsv(summary), "text/csv");
  };

  const handleExportPdf = async () => {
    setPdfError(null);
    setPdfExporting(true);
    try {
      await downloadFromRoute(
        "/api/passports/green-tax-report.pdf",
        `polymer-dpp-green-tax-report-${dateStamp}.pdf`
      );
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Failed to generate green tax report PDF");
    } finally {
      setPdfExporting(false);
    }
  };

  const handleExportXlsx = async () => {
    setXlsxError(null);
    setXlsxExporting(true);
    try {
      await downloadFromRoute(
        "/api/passports/green-tax-export.xlsx",
        `polymer-dpp-green-tax-export-${dateStamp}.xlsx`
      );
    } catch (err) {
      setXlsxError(err instanceof Error ? err.message : "Failed to generate tax & financial Excel export");
    } finally {
      setXlsxExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans overflow-x-hidden">
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
              <h1 className="text-base font-bold text-white tracking-tight">{t("greenAccounting.title")}</h1>
              <p className="text-[11px] text-slate-400 font-mono">{t("greenAccounting.subtitle")}</p>
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
              className="flex items-center gap-1.5 text-xs bg-lime-500 hover:bg-lime-400 text-slate-950 font-bold px-3 py-2 rounded-lg transition-all"
            >
              <FileJson className="w-3.5 h-3.5" />
              JSON
            </button>
            <button
              onClick={handleExportXlsx}
              disabled={xlsxExporting}
              className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-3 py-2 rounded-lg transition-all whitespace-nowrap"
              title="Export the Green Accounting + Green Valuation History workbook"
            >
              {xlsxExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5" />
              )}
              {xlsxExporting ? "Generating..." : "Export Tax & Financial Excel"}
            </button>
            <button
              onClick={handleExportPdf}
              disabled={pdfExporting}
              className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold px-3 py-2 rounded-lg transition-all whitespace-nowrap"
              title="Generate the Green Tax & Plastic Packaging Compliance Report PDF"
            >
              {pdfExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              {pdfExporting ? "Generating..." : "Export Green Tax PDF"}
            </button>
          </div>
        </div>
        {(pdfError || xlsxError) && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 -mt-1 space-y-1.5">
            {pdfError && (
              <div className="flex items-start gap-1.5 text-[11px] text-red-400 font-mono bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{pdfError}</span>
              </div>
            )}
            {xlsxError && (
              <div className="flex items-start gap-1.5 text-[11px] text-red-400 font-mono bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{xlsxError}</span>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard
            icon={TrendingDown}
            label="Gross Liability"
            value={eurFmt(summary.totalGrossLiabilityEur)}
            accent="text-amber-400"
            sub={<>If 0% of active mass were recycled — {numberFmt(summary.totalMassKg / 1000, 2)} t total</>}
          />
          <KpiCard
            icon={Recycle}
            label="PCR Tax Savings"
            value={eurFmt(summary.totalPcrTaxSavingsEur)}
            accent="text-emerald-400"
            sub={<>{numberFmt(summary.totalPcrMassKg / 1000, 2)} t PCR mass offsetting liability</>}
          />
          <KpiCard
            icon={Coins}
            label="Net Liability"
            value={eurFmt(summary.totalNetLiabilityEur)}
            accent="text-rose-400"
            sub={<>On {numberFmt(summary.totalTaxableMassKg / 1000, 2)} t non-recycled taxable mass</>}
          />
          <KpiCard
            icon={Gauge}
            label="Active Rate"
            value={`${summary.ratePerTonneEur}`}
            unit={`EUR/t · ${summary.jurisdiction}`}
            accent="text-lime-400"
            sub={<>{summary.taxParameterLabel}</>}
          />
        </div>

        <TaxParameterPanel taxParameters={taxParameters} />

        {/* Per-batch breakdown */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl overflow-x-auto">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5 mb-1">
            <Layers className="w-4 h-4 text-lime-400" /> Per-Batch Breakdown
          </h3>
          <p className="text-[11px] text-slate-400 font-mono mb-4">
            {summary.batchesWithWeightData} of {summary.activeBatches} active batches have recorded weight data
            ({summary.batchesMissingWeightData} excluded)
          </p>
          <table className="w-full text-left font-mono text-xs min-w-[760px]">
            <thead>
              <tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800">
                <th className="py-2 pr-4">Batch</th>
                <th className="py-2 pr-4">Manufacturer</th>
                <th className="py-2 pr-4 text-right">Mass (kg)</th>
                <th className="py-2 pr-4 text-right">PCR (kg)</th>
                <th className="py-2 pr-4 text-right">Gross</th>
                <th className="py-2 pr-4 text-right">Savings</th>
                <th className="py-2 pr-4 text-right">Net</th>
                <th className="py-2 text-right">Valuation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {summary.batches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-slate-500">
                    No active batches yet.
                  </td>
                </tr>
              ) : (
                summary.batches.map((b) => <BatchRow key={b.batchId} batch={b} onLocked={() => router.refresh()} />)
              )}
            </tbody>
          </table>
        </div>

        {/* Sprint 3.3 — Tax Liability Trend & Forecast */}
        <TrendForecastSection trendForecast={trendForecast} />

        {/* Caveats footer — mirrors esg-analytics-dashboard.tsx's own
            "never present illustrative/estimated data as fact" footer. */}
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-5 flex items-start gap-3 text-[11px] font-mono text-slate-400">
          <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p>
              <span className="text-slate-300 font-semibold">Mass-based figures</span> are computed only over
              batches with a recorded weight (see the Carbon Footprint calculator in each batch&apos;s detail panel) —
              batches missing weight data are excluded, never silently zeroed.
            </p>
            <p>
              <span className="text-slate-300 font-semibold">Locking a valuation</span> saves the batch&apos;s current
              live figures as an audit-trailed snapshot (BatchGreenValuation), so a later change to the rate or the
              batch&apos;s recorded weight never silently redates a filed figure.
            </p>
            <p>
              <span className="text-slate-300 font-semibold">{summary.disclaimer}</span>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
