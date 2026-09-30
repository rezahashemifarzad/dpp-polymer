"use client";

/**
 * components/dashboard/expiry-alert-banner.tsx
 * -----------------------------------------------------------------------
 * Phase 4 - Step 1: Automated Expiry & Compliance Alerts — portfolio-wide
 * widget for the admin console (app/admin/page.tsx). Distinct from the
 * existing per-row "Compliance" badge in the Material Ledger table below
 * it: that badge answers "does THIS batch have a problem"; this widget
 * answers "what needs my attention across the WHOLE portfolio right now,"
 * with expired certs first, then urgent (<=7 days), then soon (<=30 days).
 *
 * Fetches GET /api/certifications/expiry-alerts on mount (public route —
 * see that route's own file banner for why) — always live, computed
 * fresh, never dependent on whether the background check has run
 * recently. "Run Check Now" separately triggers the actual background
 * check (lib/actions/run-expiry-check.ts) — a distinct action from
 * refreshing this widget's own view, since the widget already shows
 * ground truth either way; running the check only updates the persisted
 * notification bookkeeping (AuditLog entries, lastNotifiedLevel) that a
 * human reviewing the audit trail would want, and clears/raises
 * acknowledgment state on any newly-escalated cert.
 */

import { useCallback, useEffect, useState } from "react";
import { AlertOctagon, AlertTriangle, Clock, RefreshCw, ShieldCheck, ChevronDown, ChevronUp, Check, Loader2 } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { acknowledgeExpiryAlertAction } from "@/lib/actions/acknowledge-expiry-alert";
import { runExpiryCheckAction } from "@/lib/actions/run-expiry-check";
import { ExpiryAlertBadge, formatDaysRemaining, type ExpiryBadgeTier } from "@/components/dashboard/expiry-alert-badge";

import { useLanguage } from "@/lib/hooks/use-language";
interface ExpiryAlertRow {
  certificationId: string;
  batchId: string;
  polymerType: string;
  grade: string;
  manufacturerName: string | null;
  scheme: string;
  certificateId: string;
  validUntil: string;
  daysRemaining: number;
  tier: Exclude<ExpiryBadgeTier, null>;
  verificationStatus: string;
  lastNotifiedLevel: string | null;
  alertAcknowledgedAt: string | null;
  alertAcknowledgedBy: string | null;
}

interface PortfolioExpiryAlertSummary {
  generatedAt: string;
  thresholds: { expiringSoonDays: number; expiringUrgentDays: number };
  expiredCount: number;
  expiringUrgentCount: number;
  expiringSoonCount: number;
  unacknowledgedCount: number;
  expired: ExpiryAlertRow[];
  expiringUrgent: ExpiryAlertRow[];
  expiringSoon: ExpiryAlertRow[];
  expiredTruncated: boolean;
  expiringUrgentTruncated: boolean;
  expiringSoonTruncated: boolean;
}

function SummaryChip({
  Icon,
  label,
  count,
  cls,
}: {
  Icon: typeof AlertOctagon;
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

function AlertRow({ row, onAcknowledge, acknowledging }: { row: ExpiryAlertRow; onAcknowledge: (id: string) => void; acknowledging: boolean }) {
  const { t } = useLanguage();
  return (
    <tr className="hover:bg-slate-800/40 transition-colors">
      <td className="py-2 pr-3 font-mono text-emerald-400 whitespace-nowrap">{row.batchId}</td>
      <td className="py-2 pr-3 text-slate-300 whitespace-nowrap">{row.manufacturerName ?? "—"}</td>
      <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">
        {row.scheme} <span className="text-slate-600">· {row.certificateId}</span>
      </td>
      <td className="py-2 pr-3 whitespace-nowrap">
        <ExpiryAlertBadge tier={row.tier} title={new Date(row.validUntil).toLocaleDateString()} />
      </td>
      <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">{formatDaysRemaining(row.daysRemaining, t)}</td>
      <td className="py-2 text-right whitespace-nowrap">
        {row.alertAcknowledgedAt ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
            <Check className="w-3 h-3" /> {t("ui.expiry.acknowledged")}
          </span>
        ) : (
          <button
            onClick={() => onAcknowledge(row.certificationId)}
            disabled={acknowledging}
            className="inline-flex items-center gap-1 text-[10px] bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 px-2 py-1 rounded-md transition-all"
          >
            {acknowledging ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            {t("ui.expiry.acknowledge")}
          </button>
        )}
      </td>
    </tr>
  );
}

export function ExpiryAlertBanner() {
  const { t } = useLanguage();
  const { push } = useToast();
  const [summary, setSummary] = useState<PortfolioExpiryAlertSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [runningCheck, setRunningCheck] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/certifications/expiry-alerts", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || t("ui.audit.requestFailedWithStatus", { v0: res.status }));
      }
      setSummary(json.data as PortfolioExpiryAlertSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load compliance alerts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRunCheck = async () => {
    setRunningCheck(true);
    try {
      const result = await runExpiryCheckAction();
      if (!result.ok || !result.data) {
        throw new Error(result.error || "Failed to run the expiry alert check");
      }
      const { newAlerts, escalated, evaluated } = result.data;
      push({
        variant: "success",
        title: t("ui.expiry.expiryCheckComplete"),
        description: t("ui.expiry.evaluatedCertificationSNewAlertS", { v0: evaluated, v1: newAlerts, v2: escalated }),
      });
      await load();
    } catch (err) {
      push({
        variant: "error",
        title: t("ui.expiry.expiryCheckFailed"),
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setRunningCheck(false);
    }
  };

  const handleAcknowledge = async (certificationId: string) => {
    setAcknowledgingId(certificationId);
    try {
      const result = await acknowledgeExpiryAlertAction(certificationId);
      if (!result.ok) {
        throw new Error(result.error || "Failed to acknowledge alert");
      }
      await load();
    } catch (err) {
      push({
        variant: "error",
        title: t("ui.expiry.couldnTAcknowledgeAlert"),
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setAcknowledgingId(null);
    }
  };

  if (loading && !summary) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 animate-pulse">
        <div className="h-4 w-56 bg-slate-800 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="h-16 bg-slate-800/60 rounded-2xl" />
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
          <p className="text-sm font-semibold text-red-400">{t("ui.expiry.couldnTLoadComplianceAlerts")}</p>
          <p className="text-xs text-slate-400 font-mono mt-1">{error}</p>
          <button
            onClick={load}
            className="mt-2 flex items-center gap-1.5 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg transition-all"
          >
            <RefreshCw className="w-3 h-3" /> {t("ui.common.retry")}
          </button>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const totalFlagged = summary.expiredCount + summary.expiringUrgentCount + summary.expiringSoonCount;
  const allRows = [...summary.expired, ...summary.expiringUrgent, ...summary.expiringSoon];
  const anyTruncated = summary.expiredTruncated || summary.expiringUrgentTruncated || summary.expiringSoonTruncated;

  return (
    <div
      className={`rounded-2xl border p-5 ${
        summary.expiredCount > 0
          ? "bg-rose-500/5 border-rose-500/20"
          : summary.expiringUrgentCount > 0
            ? "bg-orange-500/5 border-orange-500/20"
            : totalFlagged > 0
              ? "bg-amber-500/5 border-amber-500/20"
              : "bg-slate-900/60 border-slate-800"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {totalFlagged === 0 ? (
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white">{t("ui.expiry.complianceExpiryAlerts")}</h3>
            <p className="text-[11px] text-slate-400 font-mono">
              {totalFlagged === 0
                ? t("ui.expiry.noCertificationsExpiringWithinTheNext")
                : t("ui.expiry.unacknowledgedAcrossFlaggedCertificationS", { v0: summary.unacknowledgedCount, v1: totalFlagged })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRunCheck}
            disabled={runningCheck}
            className="flex items-center gap-1.5 text-[11px] bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 px-2.5 py-1.5 rounded-lg transition-all"
            title={t("ui.expiry.runTheBackgroundExpiryCheckNow")}
          >
            {runningCheck ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {t("ui.expiry.runCheckNow")}
          </button>
          {totalFlagged > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg transition-all"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? t("ui.common.hideDetails") : t("ui.common.viewDetails")}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        <SummaryChip
          Icon={AlertOctagon}
          label={t("notifications.chip.expired")}
          count={summary.expiredCount}
          cls="bg-rose-500/10 border-rose-500/30 text-rose-400"
        />
        <SummaryChip
          Icon={AlertTriangle}
          label={t("ui.expiry.urgentD", { v0: summary.thresholds.expiringUrgentDays })}
          count={summary.expiringUrgentCount}
          cls="bg-orange-500/10 border-orange-500/30 text-orange-400"
        />
        <SummaryChip
          Icon={Clock}
          label={t("ui.expiry.expiringSoonD", { v0: summary.thresholds.expiringSoonDays })}
          count={summary.expiringSoonCount}
          cls="bg-amber-500/10 border-amber-500/30 text-amber-400"
        />
      </div>

      {expanded && totalFlagged > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs min-w-[640px]">
            <thead>
              <tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800">
                <th className="py-2 pr-3">{t("greenAccounting.table.batch")}</th>
                <th className="py-2 pr-3">{t("greenAccounting.table.manufacturer")}</th>
                <th className="py-2 pr-3">{t("ui.expiry.certification")}</th>
                <th className="py-2 pr-3">{t("common.status")}</th>
                <th className="py-2 pr-3">{t("ui.expiry.timeline")}</th>
                <th className="py-2 text-right">{t("audit.table.action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {allRows.map((row) => (
                <AlertRow
                  key={row.certificationId}
                  row={row}
                  onAcknowledge={handleAcknowledge}
                  acknowledging={acknowledgingId === row.certificationId}
                />
              ))}
            </tbody>
          </table>
          {anyTruncated && (
            <p className="text-[10px] text-slate-500 font-mono mt-2">
              {t("ui.expiry.showingUpTo50RowsPer")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
