"use client";

// FIX (round 4 — language selector didn't translate admin pages): this
// dashboard's own header (title + subtitle) translated via
// lib/i18n/app-dictionary.ts — see that file's banner for scope.
import { useLanguage } from "@/lib/hooks/use-language";

/**
 * components/dashboard/audit-log-dashboard.tsx
 * -----------------------------------------------------------------------
 * Phase 4 - Step 3: Immutable Audit Trail / Ledger Log — the client
 * dashboard behind /admin/audit. Renders the SSR-fetched first page
 * immediately (no loading flash on initial load, matching every other
 * /admin/* dashboard's pattern), then re-fetches GET /api/audit-log
 * client-side whenever filters or the page change.
 *
 * Three independent async actions, each with its own loading/error state
 * (same convention as green-accounting-dashboard.tsx's handleExportPdf /
 * handleExportXlsx):
 *   - list/filter/paginate — GET /api/audit-log
 *   - "Verify Full Ledger" — GET /api/audit-log/verify (the hash-chain
 *     walk; deliberately on-demand, not run automatically on page load —
 *     see audit-log-service.ts's own comment on verifyAuditLogChainIntegrity)
 *   - "Export Audit Log Excel" — GET /api/audit-log/export.xlsx, current
 *     filters passed through as query params so the export matches what's
 *     on screen (fetch+blob pattern matching app/admin/page.tsx's
 *     handleExportLedgerExcel)
 *
 * Action badge coloring is intentionally keyword-driven (matches on
 * REJECT/REVOK/FLAG, VERIF, ALERT, etc.) rather than an exhaustive
 * Record<AuditAction, ...> map — a new AuditAction added to the schema
 * later renders with a sensible color automatically, no dashboard code
 * change required. Same "compute, don't hardcode" spirit as
 * deriveActorRole in lib/services/audit-log-service.ts.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ScrollText,
  RefreshCw,
  FileSpreadsheet,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Link2,
} from "lucide-react";
import type { AuditAction } from "@prisma/client";
import type { AuditLogFilterOptions } from "@/lib/services/audit-log-service";

// ----------------------------------------------------------------------------
// Types — mirror the service layer's return shapes. `createdAt` is typed
// as `string | Date` because the SSR-passed initial props arrive as real
// Date instances (RSC flight serialization preserves them), while every
// subsequent client-side GET /api/audit-log fetch returns them already
// JSON-stringified to ISO strings.
// ----------------------------------------------------------------------------

interface AuditLogEntryRow {
  id: string;
  sequence: number;
  action: AuditAction;
  actor: string;
  previousHash: string | null;
  newHash: string | null;
  metadata: unknown;
  entryHash: string;
  previousEntryHash: string | null;
  createdAt: string | Date;
  passport: { batchId: string; polymerType: string; grade: string; status: string } | null;
}

interface AuditLogListResult {
  entries: AuditLogEntryRow[];
  total: number;
  page: number;
  pageSize: number;
}

interface ChainVerificationResult {
  ok: boolean;
  totalChecked: number;
  firstSequence: number | null;
  lastSequence: number | null;
  brokenAtSequence: number | null;
  brokenReason: string | null;
}

interface AuditLogFiltersState {
  action: string;
  actorRole: string;
  dateFrom: string; // yyyy-mm-dd, <input type="date"> value
  dateTo: string;
  batchId: string;
}

const EMPTY_FILTERS: AuditLogFiltersState = { action: "", actorRole: "", dateFrom: "", dateTo: "", batchId: "" };

function formatTimestamp(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function truncateHash(hash: string | null, chars = 10): string {
  if (!hash) return "(genesis)";
  return `${hash.slice(0, chars)}…`;
}

function actionBadgeClass(action: string): string {
  const a = action.toUpperCase();
  if (a.includes("REJECT") || a.includes("REVOK") || a.includes("FLAG")) return "bg-rose-500/10 text-rose-400 border-rose-500/30";
  if (a.includes("ALERT_RAISED")) return "bg-orange-500/10 text-orange-400 border-orange-500/30";
  if (a.includes("VERIF")) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
  if (a.includes("CREATED") || a.includes("ADDED") || a.includes("APPROVED") || a.includes("LINKED")) {
    return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
  }
  if (a.includes("SUPERSEDED") || a.includes("UPDATED") || a.includes("ACKNOWLEDGED")) {
    return "bg-slate-500/10 text-slate-300 border-slate-500/30";
  }
  return "bg-lime-500/10 text-lime-400 border-lime-500/30";
}

const inputCls =
  "w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500";

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

function buildQuery(filters: AuditLogFiltersState, page: number, pageSize: number): string {
  const params = new URLSearchParams();
  if (filters.action) params.set("action", filters.action);
  if (filters.actorRole) params.set("actorRole", filters.actorRole);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.batchId) params.set("batchId", filters.batchId);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return params.toString();
}

export function AuditLogDashboard({
  initialResult,
  initialFilterOptions,
}: {
  initialResult: AuditLogListResult;
  initialFilterOptions: AuditLogFilterOptions;
}) {
  const { t } = useLanguage();
  const [result, setResult] = useState<AuditLogListResult>(initialResult);
  // Fixed for the lifetime of this dashboard (there's no page-size
  // selector) — captured once from the SSR-provided initial page so
  // fetchList below can stay a stable useCallback with no dependency on
  // `result` itself.
  const [pageSize] = useState(initialResult.pageSize || 50);
  const [filterOptions, setFilterOptions] = useState<AuditLogFilterOptions>(initialFilterOptions);
  // Phase 7 - Step 3 (Global Search & Multi-Layer Filtering Suite) — an
  // AUDIT_LOG search result links here as `/admin/audit?batchId=<id>`
  // (see lib/services/global-search.ts), same `?batchId=` deep-link
  // convention app/admin/generator/page.tsx already established for its
  // own GeneratorSuiteDashboard. Seeded once from the URL at mount; a
  // deep link therefore arrives already filtered rather than landing on
  // the unfiltered SSR page and making the visitor re-type the batch ID.
  const searchParams = useSearchParams();
  const deepLinkBatchId = searchParams.get("batchId") ?? "";
  const [filters, setFilters] = useState<AuditLogFiltersState>({ ...EMPTY_FILTERS, batchId: deepLinkBatchId });
  const [batchIdDraft, setBatchIdDraft] = useState(deepLinkBatchId);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [verification, setVerification] = useState<ChainVerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Skip the very first fetch effect run ONLY when there's no `?batchId=`
  // deep link — the SSR-rendered initialResult covers page 1 with no
  // filters, so it already matches an unfiltered first render and
  // re-fetching would be a redundant round trip. A deep link's initial
  // state does NOT match the SSR snapshot, though, so that case needs the
  // first effect run to actually fire and fetch the filtered view.
  const isFirstRun = useRef(deepLinkBatchId === "");

  const fetchList = useCallback(async (f: AuditLogFiltersState, p: number) => {
    setLoading(true);
    setListError(null);
    try {
      const res = await fetch(`/api/audit-log?${buildQuery(f, p, pageSize)}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error || `Request failed with status ${res.status}`);
      setResult(json.data);
      setFilterOptions(json.data.filterOptions);
      setPage(json.data.page);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to load the audit log");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    fetchList(filters, page);
  }, [filters, page, fetchList]);

  // Debounce the free-text batch ID search so every keystroke doesn't
  // fire a request — 400ms matches this app's other search-as-you-type
  // fields (e.g. the Material Ledger's own filter inputs).
  useEffect(() => {
    const handle = setTimeout(() => {
      setFilters((prev) => (prev.batchId === batchIdDraft ? prev : { ...prev, batchId: batchIdDraft }));
      setPage(1);
    }, 400);
    return () => clearTimeout(handle);
  }, [batchIdDraft]);

  const updateFilter = (key: keyof AuditLogFiltersState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setBatchIdDraft("");
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const res = await fetch("/api/audit-log/verify");
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error || `Request failed with status ${res.status}`);
      setVerification(json.data);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Failed to verify ledger integrity");
    } finally {
      setVerifying(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const query = buildQuery(filters, 1, pageSize);
      await downloadFromRoute(
        `/api/audit-log/export.xlsx?${query}`,
        `polymer-dpp-audit-log-export-${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to generate the audit log export workbook");
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(result.total / (result.pageSize || 50)));

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans">
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
              <h1 className="text-base font-bold text-white tracking-tight">{t("audit.title")}</h1>
              <p className="text-[11px] text-slate-400 font-mono">{t("audit.subtitle")}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => fetchList(filters, page)}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 px-3 py-2 rounded-lg transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              {t("common.refresh")}
            </button>
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold px-3 py-2 rounded-lg transition-all whitespace-nowrap"
              title="Recompute the full hash chain and confirm no entry has been tampered with"
            >
              {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              {verifying ? t("audit.button.verifying") : t("audit.button.verifyLedger")}
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-3 py-2 rounded-lg transition-all whitespace-nowrap"
              title="Export the currently filtered audit log as an Excel workbook, with an embedded integrity check"
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
              {exporting ? t("common.generating") : t("audit.button.exportExcel")}
            </button>
          </div>
        </div>
        {exportError && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 -mt-1">
            <div className="flex items-start gap-1.5 text-[11px] text-red-400 font-mono bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{exportError}</span>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6 overflow-x-hidden">
        {/* Integrity banner */}
        <div
          className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between ${
            verification === null
              ? "bg-slate-900/60 border-slate-800"
              : verification.ok
                ? "bg-emerald-500/10 border-emerald-500/30"
                : "bg-rose-500/10 border-rose-500/30"
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            {verification === null ? (
              <ShieldQuestion className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            ) : verification.ok ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">
                {verification === null
                  ? "Ledger integrity not yet checked this session"
                  : verification.ok
                    ? "Ledger integrity verified — no tampering detected"
                    : "Ledger integrity check FAILED"}
              </p>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                {verification === null &&
                  "Click \"Verify Full Ledger\" to recompute the SHA-256 hash chain over every entry."}
                {verification !== null &&
                  `Checked ${verification.totalChecked} entries` +
                    (verification.firstSequence !== null
                      ? ` (#${verification.firstSequence}–#${verification.lastSequence})`
                      : "") +
                    "."}
                {verification !== null && !verification.ok && verification.brokenReason
                  ? ` Broken at entry #${verification.brokenAtSequence}: ${verification.brokenReason}`
                  : ""}
              </p>
            </div>
          </div>
        </div>
        {verifyError && (
          <div className="flex items-start gap-1.5 text-[11px] text-red-400 font-mono bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 -mt-3">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{verifyError}</span>
          </div>
        )}

        {/* Filters */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Action</label>
              <select value={filters.action} onChange={(e) => updateFilter("action", e.target.value)} className={inputCls}>
                <option value="">All actions</option>
                {filterOptions.actions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Actor / Role</label>
              <select value={filters.actorRole} onChange={(e) => updateFilter("actorRole", e.target.value)} className={inputCls}>
                <option value="">All actors</option>
                {filterOptions.actorRoles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">From date</label>
              <input type="date" value={filters.dateFrom} onChange={(e) => updateFilter("dateFrom", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">To date</label>
              <input type="date" value={filters.dateTo} onChange={(e) => updateFilter("dateTo", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Batch ID</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  value={batchIdDraft}
                  onChange={(e) => setBatchIdDraft(e.target.value)}
                  placeholder="Search batch ID..."
                  className={`${inputCls} pl-7`}
                />
              </div>
            </div>
          </div>
          {hasActiveFilters && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">Filters active</span>
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-all"
              >
                <X className="w-3 h-3" />
                Clear filters
              </button>
            </div>
          )}
        </div>

        {listError && (
          <div className="flex items-start gap-1.5 text-[11px] text-red-400 font-mono bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{listError}</span>
          </div>
        )}

        {/* Ledger table */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-6">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
            <div className="min-w-0">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-emerald-400" />
                Chronological Ledger
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {result.total} matching {result.total === 1 ? "entry" : "entries"} · newest first
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3">{t("audit.table.seq")}</th>
                  <th className="p-3">{t("audit.table.timestamp")}</th>
                  <th className="p-3">{t("audit.table.action")}</th>
                  <th className="p-3">{t("audit.table.actor")}</th>
                  <th className="p-3">{t("audit.table.batchId")}</th>
                  <th className="p-3">{t("audit.table.entryHash")}</th>
                  <th className="p-3">{t("audit.table.chainLink")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading && result.entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-6 text-slate-500">
                      Loading ledger entries...
                    </td>
                  </tr>
                ) : result.entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-6 text-slate-500">
                      No audit log entries match the current filters.
                    </td>
                  </tr>
                ) : (
                  result.entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3 font-mono text-slate-500">#{entry.sequence}</td>
                      <td className="p-3 font-mono whitespace-nowrap">{formatTimestamp(entry.createdAt)}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center text-[10px] px-2 py-0.5 border rounded-full font-semibold whitespace-nowrap ${actionBadgeClass(entry.action)}`}
                        >
                          {entry.action}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-400 whitespace-nowrap">{entry.actor}</td>
                      <td className="p-3 font-mono text-slate-300 whitespace-nowrap">{entry.passport?.batchId ?? "—"}</td>
                      <td className="p-3 font-mono text-slate-500" title={entry.entryHash}>
                        {truncateHash(entry.entryHash)}
                      </td>
                      <td className="p-3 font-mono text-slate-600" title={entry.previousEntryHash ?? undefined}>
                        <span className="inline-flex items-center gap-1">
                          <Link2 className="w-3 h-3" />
                          {truncateHash(entry.previousEntryHash)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-800/60">
            <span className="text-[11px] text-slate-500 font-mono">
              Page {result.page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={result.page <= 1 || loading}
                className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 px-3 py-1.5 rounded-lg transition-all"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={result.page >= totalPages || loading}
                className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 px-3 py-1.5 rounded-lg transition-all"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
