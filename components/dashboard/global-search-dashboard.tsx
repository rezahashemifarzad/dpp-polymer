"use client";

/**
 * components/dashboard/global-search-dashboard.tsx
 * -----------------------------------------------------------------------
 * Global Search & Multi-Layer Filtering Suite (Phase 7 - Step 3) —
 * dedicated full-page search UI behind /admin/search. Renders the
 * SSR-fetched initial result immediately (no loading flash, matching
 * audit-log-dashboard.tsx's own pattern), then re-runs
 * lib/actions/global-search.ts's Server Action client-side whenever the
 * query or any filter changes (debounced 300ms for free text; filter chip
 * toggles re-query immediately, matching audit-log-dashboard.tsx's own
 * "text is debounced, dropdown/chip changes are not" split).
 *
 * Results render grouped by entity type (one card per type, same visual
 * shape as esg-analytics-dashboard.tsx's ManufacturerDistributionCard) —
 * comparative RANKING across suppliers already has its own dedicated page
 * (/admin/suppliers); this page's job is finding and jumping to a
 * specific record across four different tables at once, so grouped lists
 * (not one flattened, re-sortable table) is the more useful shape here.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  X,
  Loader2,
  Package,
  Award,
  Factory,
  ScrollText,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { globalSearchAction } from "@/lib/actions/global-search";
import type {
  GlobalSearchResult,
  GlobalSearchFilters,
  SearchEntityType,
  SearchResultItem,
  SearchResultTone,
} from "@/lib/services/global-search";

const ENTITY_META: Record<SearchEntityType, { label: string; icon: typeof Package; colorClass: string; chipClass: string }> = {
  BATCH: { label: "Batches", icon: Package, colorClass: "text-emerald-400", chipClass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" },
  CERTIFICATE: { label: "Certificates", icon: Award, colorClass: "text-amber-400", chipClass: "bg-amber-500/10 border-amber-500/30 text-amber-400" },
  SUPPLIER: { label: "Suppliers", icon: Factory, colorClass: "text-sky-400", chipClass: "bg-sky-500/10 border-sky-500/30 text-sky-400" },
  AUDIT_LOG: { label: "Audit Log", icon: ScrollText, colorClass: "text-fuchsia-400", chipClass: "bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400" },
};

const TONE_CLASS: Record<SearchResultTone, string> = {
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  danger: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  info: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  neutral: "bg-slate-500/10 text-slate-400 border-slate-500/30",
};

function ResultBadge({ label, tone }: { label: string; tone: SearchResultTone }) {
  return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${TONE_CLASS[tone]}`}>{label}</span>;
}

function MultiSelectChips({
  options,
  active,
  onToggle,
  formatLabel,
}: {
  options: string[];
  active: Set<string>;
  onToggle: (v: string) => void;
  formatLabel?: (v: string) => string;
}) {
  if (options.length === 0) return <span className="text-[10px] text-slate-600 font-mono">No options available.</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const isActive = active.has(opt);
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            className={`text-[10px] font-semibold px-2 py-1 rounded-full border transition-all ${
              isActive ? "bg-slate-100 text-slate-900 border-slate-100" : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
            }`}
          >
            {formatLabel ? formatLabel(opt) : opt.replace(/_/g, " ")}
          </button>
        );
      })}
    </div>
  );
}

function ResultRow({ item }: { item: SearchResultItem }) {
  const meta = ENTITY_META[item.entityType];
  const Icon = meta.icon;
  return (
    <a href={item.href} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800/50 transition-colors">
      <Icon className={`w-4 h-4 shrink-0 ${meta.colorClass}`} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-slate-100 truncate">{item.title}</div>
        <div className="text-[10px] text-slate-500 truncate font-mono">{item.subtitle}</div>
      </div>
      <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end max-w-[40%]">
        {item.badges.map((b, i) => (
          <ResultBadge key={i} label={b.label} tone={b.tone} />
        ))}
      </div>
    </a>
  );
}

function EntitySection({ type, items, count }: { type: SearchEntityType; items: SearchResultItem[]; count: number }) {
  const meta = ENTITY_META[type];
  const Icon = meta.icon;
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
          <Icon className={`w-4 h-4 ${meta.colorClass}`} />
          {meta.label}
        </h3>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.chipClass}`}>{count} match(es)</span>
      </div>
      {items.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-600 font-mono">No {meta.label.toLowerCase()} match.</div>
      ) : (
        <div className="divide-y divide-slate-800/60">
          {items.map((item) => (
            <ResultRow key={`${item.entityType}-${item.id}`} item={item} />
          ))}
        </div>
      )}
      {count > items.length && (
        <p className="text-[10px] text-slate-600 font-mono mt-3 pt-3 border-t border-slate-800/60">
          Showing {items.length} of {count} — narrow your search or filters to see more.
        </p>
      )}
    </div>
  );
}

export function GlobalSearchDashboard({
  initialResult,
  initialQuery,
}: {
  initialResult: GlobalSearchResult;
  initialQuery: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<GlobalSearchResult>(initialResult);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [entityTypes, setEntityTypes] = useState<Set<SearchEntityType>>(new Set());
  const [polymerTypes, setPolymerTypes] = useState<Set<string>>(new Set());
  const [dppStatuses, setDppStatuses] = useState<Set<string>>(new Set());
  const [certStatuses, setCertStatuses] = useState<Set<string>>(new Set());
  const [supplierTiers, setSupplierTiers] = useState<Set<string>>(new Set());
  const [auditActions, setAuditActions] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Two independent first-run guards (not one shared flag) — the query
  // effect and the filter effect each need to skip only their OWN first
  // mount, not wait on the other one to fire first. A single shared ref
  // set false only by the filter effect would leave the query effect
  // stuck returning early forever until the user also touched a filter
  // chip, silently breaking search-as-you-type on its own.
  const isFirstQueryRun = useRef(true);
  const isFirstFilterRun = useRef(true);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const filters: GlobalSearchFilters = {
      query: query.trim() || undefined,
      entityTypes: entityTypes.size > 0 ? Array.from(entityTypes) : undefined,
      polymerTypes: polymerTypes.size > 0 ? Array.from(polymerTypes) : undefined,
      dppStatuses: dppStatuses.size > 0 ? Array.from(dppStatuses) : undefined,
      certVerificationStatuses: certStatuses.size > 0 ? Array.from(certStatuses) : undefined,
      supplierTiers: supplierTiers.size > 0 ? Array.from(supplierTiers) : undefined,
      auditActions: auditActions.size > 0 ? Array.from(auditActions) : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      limitPerType: 20,
    };
    const res = await globalSearchAction(filters);
    if (res.ok && res.data) {
      setResult(res.data);
      router.replace(query.trim() ? `/admin/search?q=${encodeURIComponent(query.trim())}` : "/admin/search", { scroll: false });
    } else {
      setError(res.error ?? "Search failed");
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, entityTypes, polymerTypes, dppStatuses, certStatuses, supplierTiers, auditActions, dateFrom, dateTo]);

  // Debounce free-text query only — filter chip/date changes re-query
  // immediately below via their own effect, same split as
  // audit-log-dashboard.tsx's batchIdDraft-is-debounced /
  // dropdown-filters-are-not convention.
  useEffect(() => {
    if (isFirstQueryRun.current) {
      isFirstQueryRun.current = false;
      return;
    }
    const handle = setTimeout(() => runSearch(), 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (isFirstFilterRun.current) {
      isFirstFilterRun.current = false;
      return;
    }
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityTypes, polymerTypes, dppStatuses, certStatuses, supplierTiers, auditActions, dateFrom, dateTo]);

  // Generic over T (constrained to string) rather than fixed to
  // Set<string> — entityTypes/setEntityTypes are typed Set<SearchEntityType>
  // specifically (so the rest of the component gets real union-type
  // checking on it), while every other filter set below is a plain
  // Set<string>; a non-generic (Set<string>, ...) signature would reject
  // the SearchEntityType call site even though it's perfectly type-safe.
  const toggleSet = <T extends string>(set: Set<T>, setter: (s: Set<T>) => void, value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  const clearAllFilters = () => {
    setEntityTypes(new Set());
    setPolymerTypes(new Set());
    setDppStatuses(new Set());
    setCertStatuses(new Set());
    setSupplierTiers(new Set());
    setAuditActions(new Set());
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters =
    entityTypes.size > 0 ||
    polymerTypes.size > 0 ||
    dppStatuses.size > 0 ||
    certStatuses.size > 0 ||
    supplierTiers.size > 0 ||
    auditActions.size > 0 ||
    dateFrom !== "" ||
    dateTo !== "";

  const visibleTypes: SearchEntityType[] =
    entityTypes.size > 0 ? Array.from(entityTypes) : (["BATCH", "CERTIFICATE", "SUPPLIER", "AUDIT_LOG"] as SearchEntityType[]);

  const resultsByType: Record<SearchEntityType, SearchResultItem[]> = {
    BATCH: [],
    CERTIFICATE: [],
    SUPPLIER: [],
    AUDIT_LOG: [],
  };
  for (const item of result.results) resultsByType[item.entityType].push(item);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans overflow-x-hidden">
      <header className="border-b border-slate-800/80 bg-[#070c18]/90 backdrop-blur-2xl sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 min-h-16 py-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/admin"
              className="shrink-0 flex items-center gap-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-2 rounded-lg transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Admin Console
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                <Search className="w-4 h-4 text-cyan-400" />
                Global Search &amp; Filtering
              </h1>
              <p className="text-[11px] text-slate-400 font-mono">Batches · Certificates · Suppliers · Audit Log — all at once</p>
            </div>
          </div>
          <span className="text-[10px] text-slate-500 font-mono hidden md:inline">{result.totalCount} total match(es)</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* --- Search bar ----------------------------------------------------- */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search batch IDs, grades, certificate numbers, suppliers, actors..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none min-w-0"
          />
          {loading && <Loader2 className="w-4 h-4 text-slate-500 animate-spin shrink-0" />}
          {query && (
            <button onClick={() => setQuery("")} className="text-slate-500 hover:text-white shrink-0">
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all shrink-0 ${
              hasActiveFilters ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
            {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* --- Entity type quick chips ----------------------------------------- */}
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(ENTITY_META) as SearchEntityType[]).map((type) => {
            const meta = ENTITY_META[type];
            const Icon = meta.icon;
            const isActive = entityTypes.has(type);
            return (
              <button
                key={type}
                onClick={() => toggleSet(entityTypes, setEntityTypes, type)}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                  isActive ? meta.chipClass : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {meta.label}
                <span className="opacity-70">{result.countsByType[type]}</span>
              </button>
            );
          })}
          {hasActiveFilters && (
            <button onClick={clearAllFilters} className="text-[11px] text-slate-500 hover:text-white underline underline-offset-2 ml-1">
              Clear all filters
            </button>
          )}
        </div>

        {/* --- Advanced filter panel -------------------------------------------- */}
        {showFilters && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md">
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Date From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Date To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Polymer Type (batches)</label>
              <MultiSelectChips options={result.filterOptions.polymerTypes} active={polymerTypes} onToggle={(v) => toggleSet(polymerTypes, setPolymerTypes, v)} />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Batch Status</label>
              <MultiSelectChips options={result.filterOptions.dppStatuses} active={dppStatuses} onToggle={(v) => toggleSet(dppStatuses, setDppStatuses, v)} />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Certificate Verification Status</label>
              <MultiSelectChips options={result.filterOptions.certVerificationStatuses} active={certStatuses} onToggle={(v) => toggleSet(certStatuses, setCertStatuses, v)} />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">
                Manufacturer / Supplier Tier
              </label>
              <MultiSelectChips options={result.filterOptions.supplierTiers} active={supplierTiers} onToggle={(v) => toggleSet(supplierTiers, setSupplierTiers, v)} />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Audit Action</label>
              <MultiSelectChips options={result.filterOptions.auditActions} active={auditActions} onToggle={(v) => toggleSet(auditActions, setAuditActions, v)} />
            </div>
          </div>
        )}

        {/* --- Results, grouped by entity type ---------------------------------- */}
        {error ? (
          <div className="text-center py-10 text-sm text-rose-400 font-mono">{error}</div>
        ) : result.totalCount === 0 && !loading ? (
          <div className="text-center py-16 text-sm text-slate-500 font-mono">
            No matches. Try a different search term or clear your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {visibleTypes.map((type) => (
              <EntitySection key={type} type={type} items={resultsByType[type]} count={result.countsByType[type]} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
