"use client";

/**
 * app/admin/green-accounting/error.tsx
 * -----------------------------------------------------------------------
 * Final Polish & Stability Sprint — Next.js App Router error boundary.
 * Catches any error thrown while rendering the Server Component in
 * page.tsx (its three parallel data fetches: computePortfolioGreenAccounting,
 * listTaxParameters, computeGreenTaxTrendForecast) — a transient DB hiccup,
 * a bad query, anything — and shows a graceful, on-brand recovery screen
 * with a retry button, instead of Next.js's default error overlay or a
 * blank page. The first error.tsx in this app; other admin pages
 * (app/admin/esg-analytics, app/admin/page.tsx) can adopt the same pattern.
 *
 * Must be a Client Component (Next.js App Router requirement for
 * error.tsx) and receives `error`/`reset` from the framework — `reset()`
 * re-renders the segment (and its Server Component) without a full page
 * reload, so a transient failure can often be dismissed without losing
 * scroll position or navigation state.
 */

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, AlertTriangle } from "lucide-react";

export default function GreenAccountingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Green Accounting page failed to load:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-slate-900/60 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-rose-400" />
        </div>
        <h1 className="text-base font-bold text-white">Green Accounting couldn&apos;t load</h1>
        <p className="text-[11px] text-slate-400 font-mono mt-2">
          Something went wrong computing the portfolio&apos;s tax figures. This is usually transient — try again, or
          head back to the Admin Console.
        </p>
        {error.digest && <p className="text-[10px] text-slate-600 font-mono mt-2">Error ref: {error.digest}</p>}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-xs bg-lime-500 hover:bg-lime-400 text-slate-950 font-bold px-4 py-2 rounded-lg transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again
          </button>
          <Link
            href="/admin"
            className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-800 text-slate-300 px-4 py-2 rounded-lg transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Admin Console
          </Link>
        </div>
      </div>
    </div>
  );
}
