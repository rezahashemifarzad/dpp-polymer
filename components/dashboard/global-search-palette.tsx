"use client";

/**
 * components/dashboard/global-search-palette.tsx
 * -----------------------------------------------------------------------
 * Phase 7 - Step 3: Advanced Global Search & Multi-Layer Filtering Suite —
 * the command-palette half of the feature (see also app/admin/search/page.tsx
 * + global-search-dashboard.tsx for the full dedicated filtering page).
 * Mounted once from components/SiteNav.tsx (only on /admin/* routes — see
 * that file's own comment) so it's reachable from anywhere in the admin
 * console without being hand-copied into every /admin/* page's own header,
 * the same "one shared component, not N drifting copies" reasoning
 * SiteNav's file banner already documents for cross-page nav links.
 *
 * Opens via Cmd/Ctrl+K from anywhere it's mounted, or by clicking its own
 * trigger button. Debounced (300ms) search-as-you-type against
 * lib/actions/global-search.ts's Server Action (no RBAC key needed — see
 * that file's own comment on the dual-path convention), with multi-select
 * entity-type filter chips and instant navigation: clicking (or
 * Enter-selecting) a result closes the palette and navigates to its href.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, Package, Award, Factory, ScrollText, CornerDownLeft, SlidersHorizontal } from "lucide-react";
import { globalSearchAction } from "@/lib/actions/global-search";
import type { GlobalSearchResult, SearchEntityType, SearchResultItem, SearchResultTone } from "@/lib/services/global-search";

const ENTITY_META: Record<SearchEntityType, { label: string; icon: typeof Package; colorClass: string }> = {
  BATCH: { label: "Batches", icon: Package, colorClass: "text-emerald-400" },
  CERTIFICATE: { label: "Certificates", icon: Award, colorClass: "text-amber-400" },
  SUPPLIER: { label: "Suppliers", icon: Factory, colorClass: "text-sky-400" },
  AUDIT_LOG: { label: "Audit Log", icon: ScrollText, colorClass: "text-fuchsia-400" },
};

const TONE_CLASS: Record<SearchResultTone, string> = {
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  danger: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  info: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  neutral: "bg-slate-500/10 text-slate-400 border-slate-500/30",
};

function ResultBadge({ label, tone }: { label: string; tone: SearchResultTone }) {
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${TONE_CLASS[tone]}`}>{label}</span>
  );
}

export function GlobalSearchPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeTypes, setActiveTypes] = useState<Set<SearchEntityType>>(new Set());
  const [result, setResult] = useState<GlobalSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResult(null);
    setError(null);
    setActiveIndex(0);
  }, []);

  // Cmd/Ctrl+K opens from anywhere this component is mounted; Escape
  // closes while open. A single document-level listener, torn down on
  // unmount — cheap enough to leave attached for the component's whole
  // lifetime rather than only while `open`.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      // Focus after the modal has actually mounted, not on the same tick.
      const id = setTimeout(() => inputRef.current?.focus(), 30);
      document.body.style.overflow = "hidden";
      return () => {
        clearTimeout(id);
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  // Debounced search-as-you-type — 300ms, matching this app's other
  // search-as-you-type fields (audit-log-dashboard.tsx uses 400ms for a
  // single free-text field; this one fires slightly faster since a
  // Server Action call here has no network-header overhead to amortize).
  useEffect(() => {
    if (!open) return;
    if (!query.trim() && activeTypes.size === 0) {
      setResult(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      const res = await globalSearchAction({
        query: query.trim() || undefined,
        entityTypes: activeTypes.size > 0 ? Array.from(activeTypes) : undefined,
        limitPerType: 6,
      });
      if (res.ok && res.data) {
        setResult(res.data);
        setError(null);
      } else {
        setError(res.error ?? "Search failed");
      }
      setLoading(false);
      setActiveIndex(0);
    }, 300);
    return () => clearTimeout(handle);
  }, [query, activeTypes, open]);

  const toggleType = (type: SearchEntityType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const flatResults = result?.results ?? [];

  const navigateTo = useCallback(
    (item: SearchResultItem) => {
      close();
      router.push(item.href);
    },
    [close, router]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flatResults[activeIndex]) {
      e.preventDefault();
      navigateTo(flatResults[activeIndex]);
    }
  };

  const advancedHref = useMemo(
    () => `/admin/search${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`,
    [query]
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-2 rounded-lg transition-all"
        title="Global search (Ctrl+K)"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden md:inline text-[9px] bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-slate-500 font-mono">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[8vh] px-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={close} />
          <div className="relative w-full max-w-2xl bg-[#0a0f1e] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[78vh] flex flex-col">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 shrink-0">
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search batches, certificates, suppliers, audit log..."
                className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none min-w-0"
              />
              {loading && <Loader2 className="w-4 h-4 text-slate-500 animate-spin shrink-0" />}
              <button onClick={close} className="text-slate-500 hover:text-white shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 border-b border-slate-800/60 shrink-0">
              {(Object.keys(ENTITY_META) as SearchEntityType[]).map((type) => {
                const meta = ENTITY_META[type];
                const Icon = meta.icon;
                const isActive = activeTypes.has(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border transition-all ${
                      isActive
                        ? "bg-slate-100 text-slate-900 border-slate-100"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <Icon className={`w-3 h-3 ${isActive ? "text-slate-900" : meta.colorClass}`} />
                    {meta.label}
                    {result && result.countsByType[type] > 0 && (
                      <span className={isActive ? "text-slate-600" : "text-slate-600"}>{result.countsByType[type]}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="overflow-y-auto flex-1 min-h-[120px]">
              {!query.trim() && activeTypes.size === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 font-mono">
                  Start typing, or pick a filter chip above, to search across the whole ledger.
                </div>
              ) : error ? (
                <div className="p-8 text-center text-xs text-rose-400 font-mono">{error}</div>
              ) : flatResults.length === 0 && !loading ? (
                <div className="p-8 text-center text-xs text-slate-500 font-mono">No matches found.</div>
              ) : (
                <ul>
                  {flatResults.map((item, idx) => {
                    const meta = ENTITY_META[item.entityType];
                    const Icon = meta.icon;
                    const isActive = idx === activeIndex;
                    return (
                      <li key={`${item.entityType}-${item.id}`}>
                        <button
                          onClick={() => navigateTo(item)}
                          onMouseEnter={() => setActiveIndex(idx)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            isActive ? "bg-slate-800/70" : "hover:bg-slate-800/40"
                          }`}
                        >
                          <Icon className={`w-4 h-4 shrink-0 ${meta.colorClass}`} />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-slate-100 truncate">{item.title}</div>
                            <div className="text-[10px] text-slate-500 truncate font-mono">{item.subtitle}</div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {item.badges.slice(0, 2).map((b, i) => (
                              <ResultBadge key={i} label={b.label} tone={b.tone} />
                            ))}
                          </div>
                          {isActive && <CornerDownLeft className="w-3 h-3 text-slate-600 shrink-0" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-800 bg-slate-900/40 shrink-0">
              <span className="text-[10px] text-slate-600 font-mono hidden sm:inline">↑↓ navigate · ↵ open · esc close</span>
              <a
                href={advancedHref}
                onClick={close}
                className="flex items-center gap-1 text-[11px] font-semibold text-sky-400 hover:text-sky-300 ml-auto"
              >
                <SlidersHorizontal className="w-3 h-3" />
                Advanced Search &amp; Filters
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
