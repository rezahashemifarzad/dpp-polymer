"use client";

/**
 * components/dashboard/reach-ppwr/svhc-compliance-banner.tsx
 * -----------------------------------------------------------------------
 * Portfolio-wide REACH Article 33 SVHC compliance widget for the admin
 * console — the "portfolio-wide widget... a natural next step" flagged in
 * claude/reach-ppwr-dashboard-ui-notes.md's "Explicitly not built" section.
 * Deliberately modeled closely on components/dashboard/expiry-alert-banner.tsx
 * (fetch-on-mount from a dedicated aggregation route, summary chips,
 * expand/collapse detail table, loading/error states, severity-tinted
 * outer container) but simpler in two ways specific to this domain:
 *
 *   - No "Run Check Now" action. Expiry alerts have a background check
 *     with its own notification bookkeeping to (re-)trigger; SVHC status
 *     is a manufacturer declaration set directly via the REACH & PPWR
 *     panel (declareSvhcStatus) — there is nothing to "run" here, this
 *     widget just reflects current state, always live.
 *   - No per-row "Acknowledge" action, only "Manage". There's no
 *     acknowledgment concept for an SVHC declaration gap the way there is
 *     for an expiry alert; the actionable thing a viewer can do from this
 *     banner is open the batch's REACH & PPWR panel and declare/update its
 *     status, which is exactly what BatchDetailsModal's ReachPpwrPanel
 *     already does.
 *
 * "Manage" fetches GET /api/passports/{batchId} itself rather than reading
 * from the parent page's own passports list — usePassports() only ever
 * holds page 1 of the portfolio (GET /api/passports has no page/pageSize
 * params wired up yet), so a NOT_ASSESSED batch surfaced here from outside
 * that page would not be found by a .find(...) lookup against the parent's
 * list. Fetching directly guarantees this banner can open the modal for
 * *any* batch it lists, regardless of pagination. See onManageBatch below
 * and this feature's sprint notes for the paired fix in app/page.tsx /
 * app/admin/page.tsx that makes the modal actually render this object.
 */

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, ShieldQuestion, ShieldCheck, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import type { ApiPassport } from "@/lib/hooks/use-passports";

interface SvhcAlertRow {
  id: string;
  batchId: string;
  polymerType: string;
  grade: string;
  manufacturerName: string | null;
  status: string;
  createdAt: string;
}

interface PortfolioSvhcComplianceSummary {
  generatedAt: string;
  notAssessedCount: number;
  svhcPresentCount: number;
  notAssessed: SvhcAlertRow[];
  svhcPresent: SvhcAlertRow[];
  notAssessedTruncated: boolean;
  svhcPresentTruncated: boolean;
}

function SummaryChip({
  Icon,
  label,
  count,
  cls,
}: {
  Icon: typeof ShieldAlert;
  label: string;
  count: number;
  cls: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 ${cls}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <div className="min-w-0">
        <div className="text-lg font-extrabold font-mono leading-none">{count}</div>
        <div className="text-[10px] font-mono uppercase tracking-wide opacity-80 mt-1">{label}</div>
      </div>
    </div>
  );
}

function AlertRow({
  row,
  tier,
  onManage,
  managing,
}: {
  row: SvhcAlertRow;
  tier: "notAssessed" | "svhcPresent";
  onManage: (batchId: string) => void;
  managing: boolean;
}) {
  return (
    <tr className="hover:bg-slate-800/40 transition-colors">
      <td className="py-2 pr-3 font-mono text-emerald-400 whitespace-nowrap">{row.batchId}</td>
      <td className="py-2 pr-3 text-slate-300 whitespace-nowrap">{row.manufacturerName ?? "—"}</td>
      <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">
        {row.polymerType} <span className="text-slate-600">· {row.grade}</span>
      </td>
      <td className="py-2 pr-3 whitespace-nowrap">
        <span
          className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 border rounded-full font-semibold whitespace-nowrap ${
            tier === "notAssessed"
              ? "bg-slate-500/10 text-slate-400 border-slate-500/30"
              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
          }`}
        >
          {tier === "notAssessed" ? <ShieldQuestion className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
          {tier === "notAssessed" ? "Not Assessed" : "SVHC Present"}
        </span>
      </td>
      <td className="py-2 text-right whitespace-nowrap">
        <button
          onClick={() => onManage(row.batchId)}
          disabled={managing}
          className="inline-flex items-center gap-1 text-[10px] bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 px-2 py-1 rounded-md transition-all"
        >
          {managing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          Manage
        </button>
      </td>
    </tr>
  );
}

export function SvhcComplianceBanner({ onManageBatch }: { onManageBatch: (passport: ApiPassport) => void }) {
  const { push } = useToast();
  const [summary, setSummary] = useState<PortfolioSvhcComplianceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [managingBatchId, setManagingBatchId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/passports/svhc-alerts", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Request failed with status ${res.status}`);
      }
      setSummary(json.data as PortfolioSvhcComplianceSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load SVHC compliance alerts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleManage = async (batchId: string) => {
    setManagingBatchId(batchId);
    try {
      const res = await fetch(`/api/passports/${encodeURIComponent(batchId)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Request failed with status ${res.status}`);
      }
      onManageBatch(json.data as ApiPassport);
    } catch (err) {
      push({
        variant: "error",
        title: "Couldn't open batch",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setManagingBatchId(null);
    }
  };

  if (loading && !summary) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 animate-pulse">
        <div className="h-4 w-56 bg-slate-800 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <div className="h-16 bg-slate-800/60 rounded-2xl" />
          <div className="h-16 bg-slate-800/60 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-red-400">Couldn&apos;t load SVHC compliance alerts</p>
          <p className="text-xs text-slate-400 font-mono mt-1">{error}</p>
          <button
            onClick={load}
            className="mt-2 flex items-center gap-1.5 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg transition-all"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const totalFlagged = summary.notAssessedCount + summary.svhcPresentCount;
  const allRows: Array<{ row: SvhcAlertRow; tier: "notAssessed" | "svhcPresent" }> = [
    ...summary.notAssessed.map((row) => ({ row, tier: "notAssessed" as const })),
    ...summary.svhcPresent.map((row) => ({ row, tier: "svhcPresent" as const })),
  ];
  const anyTruncated = summary.notAssessedTruncated || summary.svhcPresentTruncated;

  return (
    <div
      className={`rounded-2xl border p-5 ${
        summary.notAssessedCount > 0
          ? "bg-amber-500/5 border-amber-500/20"
          : summary.svhcPresentCount > 0
            ? "bg-slate-900/60 border-slate-800"
            : "bg-slate-900/60 border-slate-800"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {summary.notAssessedCount === 0 ? (
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white">REACH SVHC Compliance</h3>
            <p className="text-[11px] text-slate-400 font-mono">
              {summary.notAssessedCount === 0
                ? "Every active batch has a REACH Article 33 declaration on file."
                : `${summary.notAssessedCount} batch(es) with no REACH Article 33 declaration on file.`}
            </p>
          </div>
        </div>
        {totalFlagged > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg transition-all shrink-0"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Hide Details" : "View Details"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <SummaryChip
          Icon={ShieldQuestion}
          label="Not Assessed"
          count={summary.notAssessedCount}
          cls="bg-slate-500/10 border-slate-500/30 text-slate-400"
        />
        <SummaryChip
          Icon={AlertTriangle}
          label="SVHC Present"
          count={summary.svhcPresentCount}
          cls="bg-amber-500/10 border-amber-500/30 text-amber-400"
        />
      </div>

      {expanded && totalFlagged > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs min-w-[560px]">
            <thead>
              <tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800">
                <th className="py-2 pr-3">Batch</th>
                <th className="py-2 pr-3">Manufacturer</th>
                <th className="py-2 pr-3">Material</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {allRows.map(({ row, tier }) => (
                <AlertRow
                  key={row.id}
                  row={row}
                  tier={tier}
                  onManage={handleManage}
                  managing={managingBatchId === row.batchId}
                />
              ))}
            </tbody>
          </table>
          {anyTruncated && (
            <p className="text-[10px] text-slate-500 font-mono mt-2">
              Showing up to 50 rows per tier — declare status on the ones shown to see more.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
