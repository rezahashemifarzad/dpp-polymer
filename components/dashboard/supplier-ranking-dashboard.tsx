"use client";

// FIX (round 4 — language selector didn't translate admin pages): this
// dashboard's own header (title + subtitle) translated via
// lib/i18n/app-dictionary.ts — see that file's banner for scope.
import { useLanguage } from "@/lib/hooks/use-language";

/**
 * components/dashboard/supplier-ranking-dashboard.tsx
 * -----------------------------------------------------------------------
 * Supplier Performance & Compliance Ranking Dashboard (Phase 7 - Step 2).
 * Renders the summary computed server-side by
 * lib/services/supplier-analytics.ts (see app/admin/suppliers/page.tsx, a
 * Server Component that fetches once and passes the whole
 * SupplierAnalyticsSummary down as a prop). Purely presentational + a CSV
 * export and client-side sort/expand state — no client-side data
 * fetching, so there's no risk of this page showing a ranking that
 * disagrees with what the server just computed.
 *
 * Layout mirrors this app's established analytics-dashboard shape (see
 * esg-analytics-dashboard.tsx): a sticky flex-wrap header with a back
 * link + refresh/export actions, KPI overview chips, then a sortable
 * ranking table whose rows expand in place to reveal the same
 * "labeled progress bar per weighted component" pattern
 * ReadinessIndexSection established for the ESG dashboard's own
 * transparent composite score, applied here to each supplier's
 * performanceComponents instead of one portfolio-wide index.
 */

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  Download,
  Factory,
  Award,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  BadgeCheck,
  Recycle,
  Leaf,
  Gauge,
  Boxes,
  FileWarning,
} from "lucide-react";
import type { SupplierAnalyticsSummary, SupplierScorecard, SupplierTier } from "@/lib/services/supplier-analytics";

type SortKey = "rank" | "compliance" | "currency" | "pcr" | "pcf" | "batches";

const TIER_META: Record<
  SupplierTier | "Insufficient Data",
  { hex: string; badgeClass: string; barClass: string; icon: typeof Award; label: string }
> = {
  Preferred: {
    hex: "#10b981",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    barClass: "bg-emerald-500",
    icon: Award,
    label: "Preferred",
  },
  Approved: {
    hex: "#14b8a6",
    badgeClass: "bg-teal-500/10 text-teal-400 border-teal-500/30",
    barClass: "bg-teal-500",
    icon: BadgeCheck,
    label: "Approved",
  },
  Watch: {
    hex: "#f59e0b",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    barClass: "bg-amber-500",
    icon: Clock,
    label: "Watch",
  },
  "At Risk": {
    hex: "#f43f5e",
    badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    barClass: "bg-rose-500",
    icon: AlertTriangle,
    label: "At Risk",
  },
  "Insufficient Data": {
    hex: "#64748b",
    badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/30",
    barClass: "bg-slate-500",
    icon: FileWarning,
    label: "Insufficient Data",
  },
};

const numberFmt = (n: number, maxFractionDigits = 1) => n.toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });

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

function buildCsv(summary: SupplierAnalyticsSummary): string {
  const lines: string[] = [];
  lines.push("Supplier Performance & Compliance Ranking");
  lines.push(`Generated At,${csvEscape(summary.generatedAt)}`);
  lines.push("");
  lines.push("Metric,Value");
  lines.push(`Total Suppliers,${summary.totalSuppliers}`);
  lines.push(`Ranked Suppliers (with active batches),${summary.rankedSupplierCount}`);
  lines.push(`Unassigned Batches (no supplier linked),${summary.unassignedBatchCount}`);
  lines.push(`Total Batches,${summary.totalBatches}`);
  lines.push(`Portfolio Avg Recycled Content %,${summary.portfolioAvgRecycledContentPercent}`);
  lines.push(`Portfolio Avg Carbon Footprint (kg CO2e/kg),${summary.portfolioAvgCarbonFootprintKgCO2ePerKg ?? "n/a"}`);
  lines.push(`Expiring/Expired Certificates (across all suppliers),${summary.expiringCertificatesTotal}`);
  lines.push("");
  lines.push("Tier,Count");
  for (const tier of ["Preferred", "Approved", "Watch", "At Risk"] as SupplierTier[]) {
    lines.push(`${tier},${summary.tierCounts[tier]}`);
  }
  lines.push("");
  lines.push("Supplier Ranking");
  lines.push(
    "Rank,Supplier,Country,Tier,Score,Active Batches,Total Batches,Compliance Rate %,Cert Currency %,Avg PCR %,Avg PCF (kg CO2e/kg),Expired Certs,Urgent Certs,Soon Certs"
  );
  for (const s of summary.suppliers) {
    lines.push(
      [
        s.rank ?? "—",
        csvEscape(s.manufacturerName),
        csvEscape(s.country ?? "—"),
        csvEscape(s.tier),
        s.performanceScore ?? "n/a",
        s.activeBatchCount,
        s.totalBatchCount,
        s.complianceRatePercent,
        s.certCurrencyRatePercent,
        s.avgRecycledContentPercent,
        s.avgCarbonFootprintKgCO2ePerKg ?? "n/a",
        s.certificates.expired,
        s.certificates.expiringUrgent,
        s.certificates.expiringSoon,
      ].join(",")
    );
  }
  return lines.join("\n");
}

function SummaryChip({
  icon: Icon,
  value,
  label,
  colorClass,
}: {
  icon: typeof Award;
  value: string | number;
  label: string;
  colorClass: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${colorClass}`}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 shrink-0" />
        <span className="text-2xl font-extrabold font-mono">{value}</span>
      </div>
      <div className="text-[10px] uppercase tracking-wider mt-1 opacity-80">{label}</div>
    </div>
  );
}

function ScoreBar({ score, hex }: { score: number; hex: string }) {
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="w-16 h-1.5 rounded-full bg-slate-950 overflow-hidden shrink-0">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, score))}%`, backgroundColor: hex }} />
      </div>
      <span className="font-mono text-xs text-white shrink-0">{score}</span>
    </div>
  );
}

function ExpiryChips({ certificates }: { certificates: SupplierScorecard["certificates"] }) {
  if (certificates.expired === 0 && certificates.expiringUrgent === 0 && certificates.expiringSoon === 0) {
    return <span className="text-slate-600 text-xs">—</span>;
  }
  return (
    <div className="flex items-center gap-1 flex-wrap justify-center">
      {certificates.expired > 0 && (
        <span className="text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 px-1.5 py-0.5 rounded-full">
          {certificates.expired} expired
        </span>
      )}
      {certificates.expiringUrgent > 0 && (
        <span className="text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded-full">
          {certificates.expiringUrgent} urgent
        </span>
      )}
      {certificates.expiringSoon > 0 && (
        <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
          {certificates.expiringSoon} soon
        </span>
      )}
    </div>
  );
}

function SupplierDetailRow({ supplier }: { supplier: SupplierScorecard }) {
  const meta = TIER_META[supplier.tier];
  return (
    <tr className="bg-slate-950/60">
      <td colSpan={9} className="p-4 sm:p-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5" style={{ color: meta.hex }} />
              Performance Score Breakdown
            </h4>
            {supplier.performanceScore === null ? (
              <p className="text-xs text-slate-500 font-mono">
                No active batches — this supplier has no current activity to score.
              </p>
            ) : (
              <div className="space-y-3">
                {supplier.performanceComponents.map((c) => (
                  <div key={c.key}>
                    <div className="flex items-center justify-between gap-2 text-[11px] mb-1">
                      <span className="text-slate-300 font-semibold">{c.label}</span>
                      <span className="text-slate-500 font-mono shrink-0">
                        {c.score}/100 · {Math.round(c.weight * 100)}% weight
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, Math.max(0, c.score))}%`, backgroundColor: meta.hex }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono mt-1">{c.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              Certification Breakdown
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div className="bg-slate-900 rounded-lg p-2 border border-slate-800">
                <div className="text-lg font-extrabold text-emerald-400 font-mono">{supplier.certificates.verified}</div>
                <div className="text-[9px] text-slate-500 uppercase">Verified</div>
              </div>
              <div className="bg-slate-900 rounded-lg p-2 border border-slate-800">
                <div className="text-lg font-extrabold text-amber-400 font-mono">{supplier.certificates.pendingReview}</div>
                <div className="text-[9px] text-slate-500 uppercase">Pending</div>
              </div>
              <div className="bg-slate-900 rounded-lg p-2 border border-slate-800">
                <div className="text-lg font-extrabold text-rose-400 font-mono">{supplier.certificates.rejected}</div>
                <div className="text-[9px] text-slate-500 uppercase">Rejected</div>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/60 pt-3">
              <span>VAT / Registration</span>
              <span className="font-mono text-slate-300">{supplier.vatNumber ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
              <span>Batch Status Mix</span>
              <span className="font-mono text-slate-300 text-right">
                {Object.entries(supplier.statusBreakdown)
                  .map(([status, count]) => `${status}: ${count}`)
                  .join(" · ")}
              </span>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

export function SupplierRankingDashboard({ summary }: { summary: SupplierAnalyticsSummary }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDesc, setSortDesc] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const handleRefresh = () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleExportCsv = () => {
    downloadBlob(`supplier-ranking-${new Date().toISOString().slice(0, 10)}.csv`, buildCsv(summary), "text/csv;charset=utf-8");
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sorted = useMemo(() => {
    const arr = [...summary.suppliers];
    const key = (s: SupplierScorecard): number => {
      switch (sortKey) {
        case "compliance":
          return s.complianceRatePercent;
        case "currency":
          return s.certCurrencyRatePercent;
        case "pcr":
          return s.avgRecycledContentPercent;
        case "pcf":
          return s.avgCarbonFootprintKgCO2ePerKg ?? -1;
        case "batches":
          return s.activeBatchCount;
        case "rank":
        default:
          return s.performanceScore ?? -1;
      }
    };
    arr.sort((a, b) => (sortDesc ? key(b) - key(a) : key(a) - key(b)));
    return arr;
  }, [summary.suppliers, sortKey, sortDesc]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const SortHeader = ({ label, k, align = "right" }: { label: string; k: SortKey; align?: "left" | "right" }) => (
    <th
      className={`py-2 px-2 cursor-pointer select-none hover:text-slate-200 transition-colors ${align === "right" ? "text-right" : "text-left"}`}
      onClick={() => handleSort(k)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {sortKey === k && (sortDesc ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
      </span>
    </th>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans">
      {/* Header — same min-h-16 + flex-wrap pattern as every other
          /admin/* analytics header in this app (see esg-analytics-dashboard.tsx's
          own comment on why a fixed-height, no-wrap row overflows on
          narrow viewports). */}
      {/* Bug fix — top offset bumped from 0 to the shared admin-offset
          token (SiteNav's 3.5rem + the admin sign-out bar's 2rem — see
          app/admin/layout.tsx's own comment and the
          --admin-content-offset definition in app/globals.css) now that
          both of those are sticky too; top-0 here would have made this
          header fight them for the same viewport position.
          Sticky Header Overlap fix, round 2 (2026-09-28) — this header
          previously never actually stuck: the outer div above was
          `overflow-x-hidden`, which (per the CSS overflow spec) forces
          `overflow-y: auto` too, turning it into an accidental scroll
          container that neutralizes `position: sticky` for this header.
          Moved `overflow-x-hidden` down to <main> below (where the wide
          tables it exists for actually are) and switched the offset from
          a Tailwind utility class to a plain CSS custom property consumed
          via inline style — see app/globals.css's own comment. */}
      <header
        className="border-b border-slate-800/80 bg-[#070c18]/90 backdrop-blur-2xl sticky z-40"
        style={{ top: "var(--admin-content-offset)" }}
      >
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
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                <Factory className="w-4 h-4 text-sky-400" />
                {t("suppliers.title")}
              </h1>
              <p className="text-[11px] text-slate-400 font-mono">{t("suppliers.subtitle")}</p>
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
              className="flex items-center gap-1.5 text-xs bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold px-3 py-2 rounded-lg transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              {t("suppliers.button.exportCsv")}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 overflow-x-hidden">
        {/* --- Overview KPI chips ------------------------------------------- */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <SummaryChip
            icon={Factory}
            value={summary.rankedSupplierCount}
            label={t("suppliers.kpi.rankedSuppliers")}
            colorClass="bg-sky-500/10 border-sky-500/30 text-sky-300"
          />
          <SummaryChip
            icon={Award}
            value={summary.tierCounts.Preferred}
            label={t("suppliers.tier.preferred")}
            colorClass="bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
          />
          <SummaryChip
            icon={BadgeCheck}
            value={summary.tierCounts.Approved}
            label={t("suppliers.tier.approved")}
            colorClass="bg-teal-500/10 border-teal-500/30 text-teal-300"
          />
          <SummaryChip
            icon={Clock}
            value={summary.tierCounts.Watch}
            label={t("suppliers.tier.watch")}
            colorClass="bg-amber-500/10 border-amber-500/30 text-amber-300"
          />
          <SummaryChip
            icon={AlertTriangle}
            value={summary.tierCounts["At Risk"]}
            label={t("suppliers.tier.atRisk")}
            colorClass="bg-rose-500/10 border-rose-500/30 text-rose-300"
          />
          <SummaryChip
            icon={FileWarning}
            value={summary.expiringCertificatesTotal}
            label={t("suppliers.kpi.certsExpiring")}
            colorClass="bg-orange-500/10 border-orange-500/30 text-orange-300"
          />
        </div>

        {summary.unassignedBatchCount > 0 && (
          <div className="flex items-start gap-2 bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 font-mono">
            <FileWarning className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
            {summary.unassignedBatchCount} batch(es) have no supplier (manufacturer) linked and are excluded from this
            ranking — see each batch's own record to assign one.
          </div>
        )}

        {/* --- Portfolio-wide baseline ---------------------------------------- */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <Recycle className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-extrabold text-white font-mono">{summary.portfolioAvgRecycledContentPercent}%</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Portfolio Avg PCR</div>
            </div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2 bg-teal-500/10 text-teal-400 rounded-lg border border-teal-500/20">
              <Leaf className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-extrabold text-white font-mono">
                {summary.portfolioAvgCarbonFootprintKgCO2ePerKg !== null ? numberFmt(summary.portfolioAvgCarbonFootprintKgCO2ePerKg, 3) : "—"}
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Portfolio Avg PCF (kg CO2e/kg)</div>
            </div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2 bg-violet-500/10 text-violet-400 rounded-lg border border-violet-500/20">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-extrabold text-white font-mono">{summary.totalBatches}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Total Batches Tracked</div>
            </div>
          </div>
        </div>

        {/* --- Ranking table --------------------------------------------------- */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5 mb-1">
            <Gauge className="w-4 h-4 text-sky-400" /> Supplier Ranking
          </h3>
          <p className="text-[11px] text-slate-400 font-mono mb-4">
            Click a column header to sort, click a row to expand its full score breakdown. {summary.suppliers.length} supplier(s) total.
          </p>

          {summary.suppliers.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm font-mono">
              No suppliers with linked batches yet — link a Manufacturer to a passport to see it ranked here.
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-left font-mono text-xs min-w-[880px]">
                <thead>
                  <tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800">
                    <th className="py-2 px-2 text-left">{t("suppliers.table.supplier")}</th>
                    <th className="py-2 px-2 text-left">{t("suppliers.table.tier")}</th>
                    <SortHeader label={t("greenAccounting.table.batches")} k="batches" />
                    <SortHeader label={t("suppliers.table.compliance")} k="compliance" />
                    <SortHeader label={t("suppliers.table.currency")} k="currency" />
                    <SortHeader label={t("suppliers.table.avgPcr")} k="pcr" />
                    <SortHeader label={t("suppliers.table.avgPcf")} k="pcf" />
                    <th className="py-2 px-2 text-center">{t("suppliers.table.certExpiry")}</th>
                    <SortHeader label={t("suppliers.table.score")} k="rank" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sorted.map((s) => {
                    const meta = TIER_META[s.tier];
                    const TierIcon = meta.icon;
                    const isOpen = expanded.has(s.manufacturerId);
                    return (
                      <Fragment key={s.manufacturerId}>
                        <tr
                          // Phase 7 - Step 3 (Global Search & Multi-Layer
                          // Filtering Suite) — anchor target for SUPPLIER
                          // search results, same scroll-mt-24 + zero-JS
                          // `target:` highlight convention as
                          // app/admin/page.tsx's own ledger rows.
                          id={`supplier-row-${encodeURIComponent(s.manufacturerId)}`}
                          className="hover:bg-slate-800/40 transition-colors cursor-pointer scroll-mt-24 target:bg-sky-500/10 target:ring-1 target:ring-inset target:ring-sky-500/40"
                          onClick={() => toggleExpanded(s.manufacturerId)}
                        >
                          <td className="py-2.5 px-2">
                            <div className="flex items-center gap-2">
                              {isOpen ? (
                                <ChevronUp className="w-3 h-3 text-slate-500 shrink-0" />
                              ) : (
                                <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <div className="text-slate-100 font-semibold truncate">
                                  {s.rank && <span className="text-slate-500 mr-1.5">#{s.rank}</span>}
                                  {s.manufacturerName}
                                </div>
                                {s.country && <div className="text-[10px] text-slate-500">{s.country}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-2">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 border rounded-full font-semibold ${meta.badgeClass}`}
                            >
                              <TierIcon className="w-2.5 h-2.5" />
                              {meta.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-right text-white">
                            {s.activeBatchCount}
                            <span className="text-slate-500">/{s.totalBatchCount}</span>
                          </td>
                          <td className="py-2.5 px-2 text-right text-emerald-400">{s.complianceRatePercent}%</td>
                          <td className="py-2.5 px-2 text-right text-cyan-400">{s.certCurrencyRatePercent}%</td>
                          <td className="py-2.5 px-2 text-right text-teal-400">{s.avgRecycledContentPercent}%</td>
                          <td className="py-2.5 px-2 text-right text-violet-400">
                            {s.avgCarbonFootprintKgCO2ePerKg !== null ? numberFmt(s.avgCarbonFootprintKgCO2ePerKg, 3) : "—"}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <ExpiryChips certificates={s.certificates} />
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            {s.performanceScore !== null ? (
                              <ScoreBar score={s.performanceScore} hex={meta.hex} />
                            ) : (
                              <span className="text-slate-600">n/a</span>
                            )}
                          </td>
                        </tr>
                        {isOpen && <SupplierDetailRow supplier={s} />}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-[10px] text-slate-500 font-mono pb-4">
          Scoring methodology: certification verification rate (35% weight), certificate currency / not-expired rate
          (25%), recycled content adoption vs. the EU PPWR 2030 baseline target (25%), and carbon footprint reporting
          completeness (15%) — weighted sum, 0-100. Computed fresh on every request from the same ledger figures used
          elsewhere in this app; there is no stored or cached supplier score. Suppliers with no active (non-revoked,
          non-superseded) batches show as "Insufficient Data" rather than being scored 0.
        </p>
      </main>
    </div>
  );
}
